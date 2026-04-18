export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export interface Database {
  public: {
    Tables: {
      organizations: { Row: Organization; Insert: Partial<Organization>; Update: Partial<Organization> }
      users: { Row: User; Insert: Partial<User>; Update: Partial<User> }
      companies: { Row: Company; Insert: Partial<Company>; Update: Partial<Company> }
      grants: { Row: Grant; Insert: Partial<Grant>; Update: Partial<Grant> }
      company_grant_matches: { Row: GrantMatch; Insert: Partial<GrantMatch>; Update: Partial<GrantMatch> }
      applications: { Row: Application; Insert: Partial<Application>; Update: Partial<Application> }
      documents: { Row: Document; Insert: Partial<Document>; Update: Partial<Document> }
      invoices: { Row: Invoice; Insert: Partial<Invoice>; Update: Partial<Invoice> }
      tasks: { Row: Task; Insert: Partial<Task>; Update: Partial<Task> }
      alerts: { Row: Alert; Insert: Partial<Alert>; Update: Partial<Alert> }
      application_events: { Row: ApplicationEvent; Insert: Partial<ApplicationEvent>; Update: Partial<ApplicationEvent> }
    }
    Views: Record<string, never>
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
