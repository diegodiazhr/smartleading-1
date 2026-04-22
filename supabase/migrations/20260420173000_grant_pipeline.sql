create extension if not exists pgcrypto;

create table if not exists public.grant_programs (
  id uuid primary key,
  slug text not null unique,
  title text not null,
  organismo text,
  scope text not null check (scope in ('nacional', 'autonomico', 'europeo', 'municipal')),
  source text not null,
  source_url text,
  regions text[] not null default '{}',
  sectors text[] not null default '{}',
  tags text[] not null default '{}',
  canonical_hash text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.grant_calls (
  id uuid primary key,
  grant_program_id uuid references public.grant_programs(id) on delete set null,
  grant_id uuid references public.grants(id) on delete set null,
  external_id text,
  title text not null,
  organismo text,
  publication_date date,
  opening_date date,
  deadline date,
  status text not null check (status in ('abierta', 'proxima', 'cerrada', 'archivada')),
  grant_type text not null check (grant_type in ('fondo_perdido', 'prestamo', 'mixto', 'aval', 'bonificacion')),
  scope text not null check (scope in ('nacional', 'autonomico', 'europeo', 'municipal')),
  source text not null,
  source_url text,
  summary text,
  raw_text text,
  dedupe_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists grant_calls_external_id_idx on public.grant_calls(external_id) where external_id is not null;
create index if not exists grant_calls_program_idx on public.grant_calls(grant_program_id);
create index if not exists grant_calls_dedupe_idx on public.grant_calls(dedupe_key);

create table if not exists public.grant_source_records (
  id uuid primary key,
  grant_call_id uuid references public.grant_calls(id) on delete cascade,
  grant_id uuid references public.grants(id) on delete set null,
  source text not null,
  source_kind text not null check (source_kind in ('api_json', 'html', 'pdf', 'xml', 'rss', 'manual')),
  source_url text,
  content_type text,
  http_status integer,
  content_hash text,
  content_text text,
  content_json jsonb,
  metadata jsonb not null default '{}'::jsonb,
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists grant_source_records_call_idx on public.grant_source_records(grant_call_id);
create index if not exists grant_source_records_source_hash_idx on public.grant_source_records(source, content_hash);

create table if not exists public.grant_eligibility_rules (
  id uuid primary key,
  grant_call_id uuid not null references public.grant_calls(id) on delete cascade,
  beneficiary_types text[] not null default '{}',
  company_sizes text[] not null default '{}',
  regions text[] not null default '{}',
  sectors text[] not null default '{}',
  cnae_codes text[] not null default '{}',
  legal_forms text[] not null default '{}',
  min_employees integer,
  max_employees integer,
  min_revenue numeric,
  max_revenue numeric,
  min_company_age_years integer,
  requires_no_tax_debt boolean,
  requires_no_social_security_debt boolean,
  minimis_regulation text,
  state_aid_regulation text,
  raw_rules jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists grant_eligibility_rules_call_idx on public.grant_eligibility_rules(grant_call_id);

create table if not exists public.grant_funding_terms (
  id uuid primary key,
  grant_call_id uuid not null references public.grant_calls(id) on delete cascade,
  budget_total numeric,
  budget_per_company_min numeric,
  budget_per_company_max numeric,
  grant_intensity_percent numeric,
  cofinancing_required boolean,
  anticipo_allowed boolean,
  compatibility_notes text,
  payment_modality text,
  application_channel text,
  justification_deadline date,
  raw_terms jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists grant_funding_terms_call_idx on public.grant_funding_terms(grant_call_id);

create table if not exists public.grant_document_requirements (
  id uuid primary key,
  grant_call_id uuid not null references public.grant_calls(id) on delete cascade,
  name text not null,
  phase text not null check (phase in ('application', 'subsanacion', 'justification', 'other')),
  is_required boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists grant_document_requirements_call_idx on public.grant_document_requirements(grant_call_id);

create table if not exists public.grant_expense_rules (
  id uuid primary key,
  grant_call_id uuid not null references public.grant_calls(id) on delete cascade,
  expense_type text not null,
  is_eligible boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists grant_expense_rules_call_idx on public.grant_expense_rules(grant_call_id);

create table if not exists public.grant_field_evidence (
  id uuid primary key,
  grant_call_id uuid not null references public.grant_calls(id) on delete cascade,
  field_name text not null,
  value_json jsonb,
  source_record_id uuid references public.grant_source_records(id) on delete set null,
  source_url text,
  evidence_text text,
  confidence numeric,
  last_verified_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists grant_field_evidence_call_idx on public.grant_field_evidence(grant_call_id);
create index if not exists grant_field_evidence_field_idx on public.grant_field_evidence(field_name);
