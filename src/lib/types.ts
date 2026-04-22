export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export interface Database {
  public: {
    Tables: {
      organizations: { Row: Organization; Insert: Partial<Organization>; Update: Partial<Organization> }
      users: { Row: User; Insert: Partial<User>; Update: Partial<User> }
      companies: { Row: Company; Insert: Partial<Company>; Update: Partial<Company> }
      grants: { Row: Grant; Insert: Partial<Grant>; Update: Partial<Grant> }
      grant_programs: { Row: GrantProgram; Insert: Partial<GrantProgram>; Update: Partial<GrantProgram> }
      grant_calls: { Row: GrantCall; Insert: Partial<GrantCall>; Update: Partial<GrantCall> }
      grant_publishers: { Row: GrantPublisher; Insert: Partial<GrantPublisher>; Update: Partial<GrantPublisher> }
      grant_ingestion_runs: { Row: GrantIngestionRun; Insert: Partial<GrantIngestionRun>; Update: Partial<GrantIngestionRun> }
      grant_source_records: { Row: GrantSourceRecord; Insert: Partial<GrantSourceRecord>; Update: Partial<GrantSourceRecord> }
      grant_call_documents: { Row: GrantCallDocument; Insert: Partial<GrantCallDocument>; Update: Partial<GrantCallDocument> }
      grant_eligibility_rules: { Row: GrantEligibilityRule; Insert: Partial<GrantEligibilityRule>; Update: Partial<GrantEligibilityRule> }
      grant_funding_terms: { Row: GrantFundingTerms; Insert: Partial<GrantFundingTerms>; Update: Partial<GrantFundingTerms> }
      grant_document_requirements: { Row: GrantDocumentRequirement; Insert: Partial<GrantDocumentRequirement>; Update: Partial<GrantDocumentRequirement> }
      grant_expense_rules: { Row: GrantExpenseRule; Insert: Partial<GrantExpenseRule>; Update: Partial<GrantExpenseRule> }
      grant_field_evidence: { Row: GrantFieldEvidence; Insert: Partial<GrantFieldEvidence>; Update: Partial<GrantFieldEvidence> }
      company_grant_matches: { Row: GrantMatch; Insert: Partial<GrantMatch>; Update: Partial<GrantMatch> }
      applications: { Row: Application; Insert: Partial<Application>; Update: Partial<Application> }
      documents: { Row: Document; Insert: Partial<Document>; Update: Partial<Document> }
      invoices: { Row: Invoice; Insert: Partial<Invoice>; Update: Partial<Invoice> }
      tasks: { Row: Task; Insert: Partial<Task>; Update: Partial<Task> }
      alerts: { Row: Alert; Insert: Partial<Alert>; Update: Partial<Alert> }
      application_events: { Row: ApplicationEvent; Insert: Partial<ApplicationEvent>; Update: Partial<ApplicationEvent> }
      admin_audit_logs: { Row: AdminAuditLog; Insert: Partial<AdminAuditLog>; Update: Partial<AdminAuditLog> }
    }
    Views: {
      grant_search_index: { Row: GrantSearchIndexRow }
    }
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}

export interface Organization {
  id: string
  name: string
  type: 'empresa' | 'asesoria' | 'gestoria' | 'enterprise'
  plan: 'free' | 'starter' | 'growth' | 'scale' | 'enterprise'
  white_label_config: Json
  commission_rate: number
  created_at: string
  updated_at: string
}

export interface User {
  id: string
  organization_id: string
  email: string
  full_name: string | null
  role: 'owner' | 'admin' | 'manager' | 'viewer' | 'client'
  notification_prefs: Json
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export interface Company {
  id: string
  organization_id: string
  name: string
  cif: string
  cnae_primary: string | null
  cnae_secondary: string[]
  employees_count: number
  revenue_annual: number
  revenue_growth: number
  founding_date: string | null
  region: string | null
  municipality: string | null
  address: string | null
  website: string | null
  is_startup: boolean
  has_rd: boolean
  export_percentage: number
  digitalization_level: number
  innovation_level: number
  sustainability_score: number
  has_tax_debts: boolean
  has_social_security_debts: boolean
  approved_grants_count: number
  total_grants_received: number
  doc_score: number
  created_at: string
  updated_at: string
}

export interface Grant {
  id: string
  external_id: string | null
  title: string
  body: string | null
  organismo: string | null
  source: 'bdns' | 'boe' | 'doue' | 'cdti' | 'enisa' | 'icex' | 'ccaa' | 'municipal' | 'manual' | 'other'
  source_url: string | null
  publication_date: string | null
  opening_date: string | null
  deadline: string | null
  budget_total: number | null
  budget_per_company_min: number | null
  budget_per_company_max: number | null
  grant_type: 'fondo_perdido' | 'prestamo' | 'mixto' | 'aval' | 'bonificacion'
  scope: 'nacional' | 'autonomico' | 'europeo' | 'municipal'
  regions: string[]
  sectors: string[]
  cnae_codes: string[]
  min_employees: number | null
  max_employees: number | null
  min_revenue: number | null
  max_revenue: number | null
  min_company_age_years: number | null
  requirements: Json
  eligible_expenses: Json
  required_documents: Json
  keywords: string[]
  tags: string[]
  status: 'abierta' | 'proxima' | 'cerrada' | 'archivada'
  difficulty_score: number
  success_rate: number | null
  summary: string | null
  raw_text: string | null
  created_at: string
  updated_at: string
}

export interface GrantProgram {
  id: string
  slug: string
  title: string
  organismo: string | null
  scope: 'nacional' | 'autonomico' | 'europeo' | 'municipal'
  source: 'bdns' | 'boe' | 'doue' | 'cdti' | 'enisa' | 'icex' | 'ccaa' | 'municipal' | 'manual' | 'other'
  source_url: string | null
  regions: string[]
  sectors: string[]
  tags: string[]
  canonical_hash: string | null
  first_seen_at: string
  last_seen_at: string
  created_at: string
  updated_at: string
}

export interface GrantCall {
  id: string
  grant_program_id: string | null
  grant_id: string | null
  external_id: string | null
  title: string
  organismo: string | null
  publication_date: string | null
  opening_date: string | null
  deadline: string | null
  status: 'abierta' | 'proxima' | 'cerrada' | 'archivada'
  grant_type: 'fondo_perdido' | 'prestamo' | 'mixto' | 'aval' | 'bonificacion'
  scope: 'nacional' | 'autonomico' | 'europeo' | 'municipal'
  source: 'bdns' | 'boe' | 'doue' | 'cdti' | 'enisa' | 'icex' | 'ccaa' | 'municipal' | 'manual' | 'other'
  source_url: string | null
  summary: string | null
  raw_text: string | null
  dedupe_key: string | null
  publication_status: 'draft' | 'enriched' | 'published' | 'rejected'
  quality_score: number
  detail_completeness: number
  last_enriched_at: string | null
  preferred_detail_source_record_id: string | null
  created_at: string
  updated_at: string
}

export interface GrantPublisher {
  id: string
  code: string
  name: string
  level: 'estado' | 'ccaa' | 'local' | 'ue'
  territory: string | null
  authority_name: string | null
  kind: 'api' | 'rss' | 'xml' | 'html' | 'pdf' | 'portal'
  parser_key: string | null
  discovery_url: string | null
  detail_url_pattern: string | null
  is_active: boolean
  priority: number
  created_at: string
  updated_at: string
}

export interface GrantIngestionRun {
  id: string
  publisher_id: string
  status: 'running' | 'success' | 'error' | 'partial' | 'skipped'
  started_at: string
  finished_at: string | null
  cursor: string | null
  discovered_count: number
  fetched_count: number
  enriched_count: number
  published_count: number
  rejected_count: number
  error_summary: string | null
  metadata: Json
  created_at: string
}

export interface GrantSourceRecord {
  id: string
  grant_call_id: string | null
  grant_id: string | null
  source: string
  source_kind: 'api_json' | 'html' | 'pdf' | 'xml' | 'rss' | 'manual'
  source_url: string | null
  content_type: string | null
  http_status: number | null
  content_hash: string | null
  content_text: string | null
  content_json: Json
  metadata: Json
  fetched_at: string
  created_at: string
}

export interface GrantCallDocument {
  id: string
  grant_call_id: string
  source_record_id: string | null
  title: string | null
  document_type: 'bases' | 'convocatoria' | 'extracto' | 'anexo' | 'faq' | 'formulario'
  is_primary: boolean
  url: string
  mime_type: string | null
  content_hash: string | null
  content_text: string | null
  metadata: Json
  created_at: string
  updated_at: string
}

export interface GrantEligibilityRule {
  id: string
  grant_call_id: string
  beneficiary_types: string[]
  company_sizes: string[]
  company_stages: string[]
  regions: string[]
  sectors: string[]
  cnae_codes: string[]
  legal_forms: string[]
  min_employees: number | null
  max_employees: number | null
  min_revenue: number | null
  max_revenue: number | null
  min_company_age_years: number | null
  requires_spanish_establishment: boolean | null
  consortium_required: boolean | null
  requires_no_tax_debt: boolean | null
  requires_no_social_security_debt: boolean | null
  minimis_regulation: string | null
  state_aid_regulation: string | null
  innovation_themes: string[]
  raw_rules: Json
  created_at: string
  updated_at: string
}

export interface GrantFundingTerms {
  id: string
  grant_call_id: string
  budget_total: number | null
  budget_per_company_min: number | null
  budget_per_company_max: number | null
  grant_intensity_percent: number | null
  cofinancing_required: boolean | null
  anticipo_allowed: boolean | null
  compatibility_notes: string | null
  payment_modality: string | null
  application_channel: string | null
  justification_deadline: string | null
  raw_terms: Json
  created_at: string
  updated_at: string
}

export interface GrantDocumentRequirement {
  id: string
  grant_call_id: string
  name: string
  phase: 'application' | 'subsanacion' | 'justification' | 'other'
  is_required: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export interface GrantExpenseRule {
  id: string
  grant_call_id: string
  expense_type: string
  is_eligible: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export interface GrantFieldEvidence {
  id: string
  grant_call_id: string
  field_name: string
  value_json: Json
  source_record_id: string | null
  source_url: string | null
  evidence_text: string | null
  confidence: number | null
  last_verified_at: string
  created_at: string
  updated_at: string
}

export interface GrantMatch {
  id: string
  company_id: string
  grant_id: string
  eligibility_score: number
  fit_score: number
  success_probability: number
  potential_amount: number
  urgency_score: number
  rejection_risks: Json
  recommendations: Json
  is_dismissed: boolean
  is_saved: boolean
  last_calculated: string
  created_at: string
  grant?: Grant
}

export interface Application {
  id: string
  company_id: string
  grant_id: string | null
  organization_id: string
  status: 'draft' | 'review' | 'submitted' | 'subsanacion' | 'approved' | 'denied' | 'pending_justification' | 'justified' | 'closed'
  requested_amount: number | null
  approved_amount: number | null
  justified_amount: number
  submission_date: string | null
  resolution_date: string | null
  justification_deadline: string | null
  reference_number: string | null
  notes: string | null
  assigned_to: string | null
  ai_quality_score: number | null
  metadata: Json
  created_at: string
  updated_at: string
  grant?: Grant
  company?: Company
}

export interface Document {
  id: string
  application_id: string | null
  company_id: string | null
  organization_id: string
  type: string
  name: string
  storage_path: string | null
  size_bytes: number | null
  mime_type: string | null
  is_subventionable: boolean | null
  subventionable_amount: number | null
  ai_classification: Json
  ai_confidence: number
  upload_channel: string
  uploaded_by: string | null
  created_at: string
}

export interface Invoice {
  id: string
  document_id: string | null
  application_id: string | null
  company_id: string | null
  supplier_name: string | null
  supplier_cif: string | null
  invoice_number: string | null
  invoice_date: string | null
  amount_net: number | null
  vat_rate: number
  amount_total: number | null
  concept: string | null
  expense_category: string | null
  is_eligible: boolean | null
  rejection_reason: string | null
  payment_date: string | null
  payment_proof_doc_id: string | null
  ai_extracted: boolean
  ai_confidence: number
  created_at: string
  updated_at: string
}

export interface Task {
  id: string
  application_id: string | null
  company_id: string | null
  organization_id: string
  title: string
  description: string | null
  due_date: string | null
  priority: 'critical' | 'high' | 'medium' | 'low'
  status: 'pending' | 'in_progress' | 'completed' | 'overdue'
  type: 'document' | 'action' | 'deadline' | 'alert' | 'subsanacion'
  assigned_to: string | null
  created_at: string
  updated_at: string
}

export interface Alert {
  id: string
  organization_id: string
  company_id: string | null
  type: string
  title: string
  message: string | null
  grant_id: string | null
  application_id: string | null
  channels: string[]
  is_read: boolean
  sent_at: string | null
  created_at: string
  grant?: Grant
}

export interface ApplicationEvent {
  id: string
  application_id: string
  type: string
  title: string
  description: string | null
  metadata: Json
  created_by: string | null
  created_at: string
}

export interface AdminAuditLog {
  id: string
  actor_user_id: string | null
  action: string
  entity_type: string | null
  entity_id: string | null
  target_label: string | null
  status: 'info' | 'success' | 'error'
  metadata: Json
  created_at: string
}

export interface GrantSearchIndexRow {
  grant_call_id: string
  grant_id: string | null
  external_id: string | null
  title_public: string
  summary_public: string | null
  search_text: string | null
  publication_status: 'draft' | 'enriched' | 'published' | 'rejected'
  quality_score: number
  detail_completeness: number
  status: 'abierta' | 'proxima' | 'cerrada' | 'archivada'
  grant_type: 'fondo_perdido' | 'prestamo' | 'mixto' | 'aval' | 'bonificacion'
  scope: 'nacional' | 'autonomico' | 'europeo' | 'municipal'
  source: Grant['source']
  source_url: string | null
  source_level: 'estado' | 'ccaa' | 'local' | 'ue'
  territory: string | null
  organismo: string | null
  publication_date: string | null
  opening_date: string | null
  deadline: string | null
  beneficiary_types: string[]
  company_sizes: string[]
  company_stages: string[]
  legal_forms: string[]
  regions: string[]
  sectors: string[]
  cnae_codes: string[]
  innovation_themes: string[]
  requires_spanish_establishment: boolean | null
  consortium_required: boolean | null
  budget_total: number | null
  budget_per_company_min: number | null
  budget_per_company_max: number | null
  grant_intensity_percent: number | null
  application_channel: string | null
  has_official_docs: boolean
  official_doc_count: number
  source_authority: string | null
  source_priority: number
}
