create extension if not exists pg_trgm;

create index if not exists grant_calls_title_trgm_idx
  on public.grant_calls
  using gin (title gin_trgm_ops);

create index if not exists grant_calls_summary_trgm_idx
  on public.grant_calls
  using gin (summary gin_trgm_ops);

create index if not exists grant_calls_raw_text_trgm_idx
  on public.grant_calls
  using gin (raw_text gin_trgm_ops);

create index if not exists grant_calls_status_scope_idx
  on public.grant_calls(status, scope, grant_type);

create index if not exists grant_funding_terms_amount_idx
  on public.grant_funding_terms(grant_call_id, budget_per_company_max, budget_total);

create index if not exists grant_eligibility_rules_regions_idx
  on public.grant_eligibility_rules using gin (regions);

create index if not exists grant_eligibility_rules_cnae_idx
  on public.grant_eligibility_rules using gin (cnae_codes);

create index if not exists grant_eligibility_rules_sizes_idx
  on public.grant_eligibility_rules using gin (company_sizes);
