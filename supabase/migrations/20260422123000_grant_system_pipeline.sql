create table if not exists public.grant_publishers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  level text not null check (level in ('estado', 'ccaa', 'local', 'ue')),
  territory text,
  authority_name text,
  kind text not null check (kind in ('api', 'rss', 'xml', 'html', 'pdf', 'portal')),
  parser_key text,
  discovery_url text,
  detail_url_pattern text,
  is_active boolean not null default true,
  priority integer not null default 50,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists grant_publishers_level_idx on public.grant_publishers(level, is_active);
create index if not exists grant_publishers_priority_idx on public.grant_publishers(priority desc);

create table if not exists public.grant_ingestion_runs (
  id uuid primary key default gen_random_uuid(),
  publisher_id uuid not null references public.grant_publishers(id) on delete cascade,
  status text not null check (status in ('running', 'success', 'error', 'partial', 'skipped')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  cursor text,
  discovered_count integer not null default 0,
  fetched_count integer not null default 0,
  enriched_count integer not null default 0,
  published_count integer not null default 0,
  rejected_count integer not null default 0,
  error_summary text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists grant_ingestion_runs_publisher_idx on public.grant_ingestion_runs(publisher_id, started_at desc);
create index if not exists grant_ingestion_runs_status_idx on public.grant_ingestion_runs(status, started_at desc);

alter table public.grant_calls
  add column if not exists publication_status text not null default 'draft',
  add column if not exists quality_score numeric not null default 0,
  add column if not exists detail_completeness numeric not null default 0,
  add column if not exists last_enriched_at timestamptz,
  add column if not exists preferred_detail_source_record_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'grant_calls_publication_status_check'
  ) then
    alter table public.grant_calls
      add constraint grant_calls_publication_status_check
      check (publication_status in ('draft', 'enriched', 'published', 'rejected'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'grant_calls_preferred_source_record_fk'
  ) then
    alter table public.grant_calls
      add constraint grant_calls_preferred_source_record_fk
      foreign key (preferred_detail_source_record_id)
      references public.grant_source_records(id)
      on delete set null;
  end if;
end $$;

create index if not exists grant_calls_publication_status_idx on public.grant_calls(publication_status, status, scope);
create index if not exists grant_calls_quality_idx on public.grant_calls(quality_score desc, detail_completeness desc);
create index if not exists grant_calls_preferred_source_idx on public.grant_calls(preferred_detail_source_record_id);

alter table public.grant_eligibility_rules
  add column if not exists company_stages text[] not null default '{}',
  add column if not exists requires_spanish_establishment boolean,
  add column if not exists consortium_required boolean,
  add column if not exists innovation_themes text[] not null default '{}';

create index if not exists grant_eligibility_rules_company_stages_idx
  on public.grant_eligibility_rules using gin (company_stages);

create index if not exists grant_eligibility_rules_innovation_themes_idx
  on public.grant_eligibility_rules using gin (innovation_themes);

create table if not exists public.grant_call_documents (
  id uuid primary key default gen_random_uuid(),
  grant_call_id uuid not null references public.grant_calls(id) on delete cascade,
  source_record_id uuid references public.grant_source_records(id) on delete set null,
  title text,
  document_type text not null,
  is_primary boolean not null default false,
  url text not null,
  mime_type text,
  content_hash text,
  content_text text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'grant_call_documents_type_check'
  ) then
    alter table public.grant_call_documents
      add constraint grant_call_documents_type_check
      check (document_type in ('bases', 'convocatoria', 'extracto', 'anexo', 'faq', 'formulario'));
  end if;
end $$;

create unique index if not exists grant_call_documents_unique_url_idx
  on public.grant_call_documents(grant_call_id, url);

create index if not exists grant_call_documents_primary_idx
  on public.grant_call_documents(grant_call_id, is_primary);

create index if not exists grant_call_documents_hash_idx
  on public.grant_call_documents(content_hash);

with ranked_source_records as (
  select
    sr.id,
    sr.grant_call_id,
    coalesce(sr.source_url, gc.source_url) as resolved_url,
    gc.title,
    gc.source_url as call_source_url,
    sr.content_type,
    sr.content_hash,
    sr.content_text,
    sr.metadata,
    sr.source_kind,
    row_number() over (
      partition by sr.grant_call_id
      order by
        case when sr.source_url is not distinct from gc.source_url then 0 else 1 end,
        case when sr.source_kind in ('pdf', 'html', 'xml') then 0 else 1 end,
        coalesce(sr.fetched_at, sr.created_at) desc
    ) as priority_rank
  from public.grant_source_records sr
  join public.grant_calls gc on gc.id = sr.grant_call_id
  where sr.grant_call_id is not null
),
backfill_source_docs as (
  select
    gen_random_uuid() as id,
    rsr.grant_call_id,
    rsr.id as source_record_id,
    rsr.title,
    case
      when coalesce(rsr.content_type, '') ilike '%pdf%' then 'bases'
      when coalesce(rsr.resolved_url, '') ~* '(anexo|annex)' then 'anexo'
      when coalesce(rsr.resolved_url, '') ~* '(faq|preguntas)' then 'faq'
      when coalesce(rsr.resolved_url, '') ~* '(formulario|solicitud)' then 'formulario'
      when rsr.source_kind in ('html', 'xml') then 'convocatoria'
      else 'extracto'
    end as document_type,
    rsr.priority_rank = 1 as is_primary,
    rsr.resolved_url as url,
    rsr.content_type as mime_type,
    rsr.content_hash,
    rsr.content_text,
    coalesce(rsr.metadata, '{}'::jsonb) || jsonb_build_object('backfilled', true) as metadata
  from ranked_source_records rsr
  where rsr.resolved_url is not null
)
insert into public.grant_call_documents (
  id,
  grant_call_id,
  source_record_id,
  title,
  document_type,
  is_primary,
  url,
  mime_type,
  content_hash,
  content_text,
  metadata
)
select
  bsd.id,
  bsd.grant_call_id,
  bsd.source_record_id,
  bsd.title,
  bsd.document_type,
  bsd.is_primary,
  bsd.url,
  bsd.mime_type,
  bsd.content_hash,
  bsd.content_text,
  bsd.metadata
from backfill_source_docs bsd
where not exists (
  select 1
  from public.grant_call_documents gcd
  where gcd.grant_call_id = bsd.grant_call_id
    and gcd.url = bsd.url
);

insert into public.grant_call_documents (
  grant_call_id,
  title,
  document_type,
  is_primary,
  url,
  mime_type,
  content_hash,
  content_text,
  metadata
)
select
  gc.id,
  gc.title,
  'convocatoria',
  true,
  gc.source_url,
  null,
  null,
  gc.raw_text,
  jsonb_build_object('backfilled', true, 'origin', 'grant_calls.source_url')
from public.grant_calls gc
where gc.source_url is not null
  and not exists (
    select 1
    from public.grant_call_documents gcd
    where gcd.grant_call_id = gc.id
      and gcd.url = gc.source_url
  );

update public.grant_calls gc
set preferred_detail_source_record_id = coalesce(
  (
    select sr.id
    from public.grant_source_records sr
    where sr.grant_call_id = gc.id
      and sr.source_url is not distinct from gc.source_url
    order by coalesce(sr.fetched_at, sr.created_at) desc
    limit 1
  ),
  (
    select sr.id
    from public.grant_source_records sr
    where sr.grant_call_id = gc.id
    order by
      case when sr.source_kind in ('pdf', 'html', 'xml') then 0 else 1 end,
      coalesce(sr.fetched_at, sr.created_at) desc
    limit 1
  )
)
where gc.preferred_detail_source_record_id is null;

with signals as (
  select
    gc.id,
    case when length(trim(gc.title)) >= 12 then 1 else 0 end as has_title,
    case when length(trim(coalesce(gc.summary, ''))) >= 80 then 1 else 0 end as has_summary,
    case when gc.source_url is not null or exists (
      select 1
      from public.grant_source_records sr
      where sr.grant_call_id = gc.id
        and coalesce(sr.http_status, 200) between 200 and 399
    ) then 1 else 0 end as has_official_source,
    case when exists (
      select 1
      from public.grant_eligibility_rules ger
      where ger.grant_call_id = gc.id
        and coalesce(array_length(ger.beneficiary_types, 1), 0) > 0
    ) then 1 else 0 end as has_beneficiaries,
    case when exists (
      select 1
      from public.grant_eligibility_rules ger
      where ger.grant_call_id = gc.id
        and (
          coalesce(jsonb_array_length(case when jsonb_typeof(ger.raw_rules -> 'requirements') = 'array' then ger.raw_rules -> 'requirements' else '[]'::jsonb end), 0) > 0
          or length(trim(coalesce(ger.raw_rules::text, ''))) > 10
        )
    ) then 1 else 0 end as has_requirements,
    case when exists (
      select 1
      from public.grant_funding_terms gft
      where gft.grant_call_id = gc.id
        and (
          gft.budget_total is not null
          or gft.budget_per_company_min is not null
          or gft.budget_per_company_max is not null
          or gft.grant_intensity_percent is not null
        )
    ) then 1 else 0 end as has_funding,
    case when gc.deadline is not null or gc.opening_date is not null or gc.status in ('abierta', 'proxima') then 1 else 0 end as has_timeline,
    case when exists (
      select 1
      from public.grant_field_evidence gfe
      where gfe.grant_call_id = gc.id
        and coalesce(gfe.confidence, 0) >= 0.5
        and gfe.evidence_text is not null
    ) then 1 else 0 end as has_evidence,
    case when exists (
      select 1
      from public.grant_call_documents gcd
      where gcd.grant_call_id = gc.id
        and gcd.is_primary = true
    ) then 1 else 0 end as has_primary_document,
    case when exists (
      select 1
      from public.grant_call_documents gcd
      where gcd.grant_call_id = gc.id
    ) then 1 else 0 end as has_documents,
    case when exists (
      select 1
      from public.grant_source_records sr
      where sr.grant_call_id = gc.id
    ) then 1 else 0 end as has_sources
  from public.grant_calls gc
)
update public.grant_calls gc
set
  quality_score = round((((s.has_title + s.has_summary + s.has_official_source + s.has_beneficiaries + s.has_requirements + s.has_funding + s.has_timeline + s.has_evidence)::numeric / 8) * 100), 1),
  detail_completeness = round((((s.has_title + s.has_summary + s.has_official_source + s.has_beneficiaries + s.has_requirements + s.has_funding + s.has_timeline + s.has_evidence + s.has_primary_document + s.has_documents + s.has_sources)::numeric / 11) * 100), 1),
  publication_status = case
    when s.has_title = 1
      and s.has_summary = 1
      and s.has_official_source = 1
      and s.has_beneficiaries = 1
      and s.has_requirements = 1
      and s.has_funding = 1
      and s.has_timeline = 1
      and s.has_evidence = 1 then 'published'
    when s.has_summary = 1
      and s.has_official_source = 1
      and (s.has_beneficiaries + s.has_requirements + s.has_funding + s.has_timeline + s.has_evidence) >= 3 then 'enriched'
    when s.has_official_source = 0
      and (s.has_summary + s.has_requirements + s.has_funding + s.has_evidence) <= 1 then 'rejected'
    else 'draft'
  end,
  last_enriched_at = coalesce(gc.last_enriched_at, gc.updated_at, gc.created_at)
from signals s
where s.id = gc.id;

create or replace view public.grant_search_index as
with docs as (
  select
    grant_call_id,
    count(*)::integer as official_doc_count,
    bool_or(is_primary) as has_primary_doc
  from public.grant_call_documents
  group by grant_call_id
),
source_meta as (
  select
    gc.id as grant_call_id,
    coalesce(
      gp.level,
      case gc.scope
        when 'nacional' then 'estado'
        when 'autonomico' then 'ccaa'
        when 'municipal' then 'local'
        when 'europeo' then 'ue'
        else 'estado'
      end
    ) as source_level,
    coalesce(gp.territory, nullif((ger.regions)[1], '')) as territory,
    gp.authority_name,
    gp.priority as source_priority
  from public.grant_calls gc
  left join public.grant_publishers gp on gp.code = gc.source
  left join public.grant_eligibility_rules ger on ger.grant_call_id = gc.id
)
select
  gc.id as grant_call_id,
  gc.grant_id,
  gc.external_id,
  gc.title as title_public,
  coalesce(gc.summary, left(gc.raw_text, 320)) as summary_public,
  trim(concat_ws(
    ' ',
    gc.title,
    gc.summary,
    gc.raw_text,
    gc.organismo,
    array_to_string(coalesce(ger.beneficiary_types, '{}'::text[]), ' '),
    array_to_string(coalesce(ger.company_sizes, '{}'::text[]), ' '),
    array_to_string(coalesce(ger.company_stages, '{}'::text[]), ' '),
    array_to_string(coalesce(ger.regions, '{}'::text[]), ' '),
    array_to_string(coalesce(ger.sectors, '{}'::text[]), ' '),
    array_to_string(coalesce(ger.cnae_codes, '{}'::text[]), ' '),
    array_to_string(coalesce(ger.innovation_themes, '{}'::text[]), ' ')
  )) as search_text,
  gc.publication_status,
  gc.quality_score,
  gc.detail_completeness,
  gc.status,
  gc.grant_type,
  gc.scope,
  gc.source,
  gc.source_url,
  sm.source_level,
  coalesce(
    sm.territory,
    case gc.scope
      when 'nacional' then 'España'
      when 'autonomico' then 'Autonómico'
      when 'municipal' then 'Local'
      when 'europeo' then 'Unión Europea'
      else 'España'
    end
  ) as territory,
  gc.organismo,
  gc.publication_date,
  gc.opening_date,
  gc.deadline,
  ger.beneficiary_types,
  ger.company_sizes,
  ger.company_stages,
  ger.legal_forms,
  ger.regions,
  ger.sectors,
  ger.cnae_codes,
  ger.innovation_themes,
  ger.requires_spanish_establishment,
  ger.consortium_required,
  ft.budget_total,
  ft.budget_per_company_min,
  ft.budget_per_company_max,
  ft.grant_intensity_percent,
  ft.application_channel,
  coalesce(docs.has_primary_doc, false) as has_official_docs,
  coalesce(docs.official_doc_count, 0) as official_doc_count,
  coalesce(sm.authority_name, gc.organismo) as source_authority,
  coalesce(sm.source_priority, 50) as source_priority
from public.grant_calls gc
left join public.grant_eligibility_rules ger on ger.grant_call_id = gc.id
left join public.grant_funding_terms ft on ft.grant_call_id = gc.id
left join docs on docs.grant_call_id = gc.id
left join source_meta sm on sm.grant_call_id = gc.id;
