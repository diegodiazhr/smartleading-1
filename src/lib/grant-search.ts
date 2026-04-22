import { createAdminClient } from '@/lib/supabase/admin'
import type { Company, Grant, GrantSearchIndexRow } from '@/lib/types'

export interface SearchParams {
  q: string
  scope: string
  grantType: string
  status: string
  minAmount: number
  paraMe: boolean
  sort: string
  page: number
  pageSize: number
  beneficiary?: string
  sourceLevel?: string
  territory?: string
  companyStage?: string
  legalForm?: string
  quality?: string
  hasOfficialDocs?: boolean
}

export interface GrantSearchResult extends Grant {
  eligibility_score?: number
  potential_amount_match?: number
  quality_score?: number
  publication_status?: 'draft' | 'enriched' | 'published' | 'rejected'
  source_level?: 'estado' | 'ccaa' | 'local' | 'ue'
}

interface RankedCandidate {
  grant: GrantSearchResult
  finalScore: number
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function tokenize(q: string): string[] {
  const stopwords = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'un', 'una', 'para', 'por', 'con', 'en', 'y', 'o'])
  return normalizeText(q)
    .split(/\s+/)
    .filter(token => token.length >= 2 && !stopwords.has(token))
    .slice(0, 8)
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value))
}

function companySize(company: Company): 'micro' | 'small' | 'medium' | 'large' {
  if (company.employees_count <= 9) return 'micro'
  if (company.employees_count <= 49) return 'small'
  if (company.employees_count <= 249) return 'medium'
  return 'large'
}

function companyAgeYears(company: Company): number | null {
  if (!company.founding_date) return null
  const ms = Date.now() - new Date(company.founding_date).getTime()
  return Math.floor(ms / (1000 * 60 * 60 * 24 * 365))
}

function arrayMatches(values: string[], query: string) {
  const needle = normalizeText(query)
  return values.some(value => {
    const hay = normalizeText(value)
    return hay.includes(needle) || needle.includes(hay)
  })
}

function regionCompatible(company: Company, row: GrantSearchIndexRow) {
  if ((row.regions ?? []).length === 0) return true
  if (!company.region) return false
  return arrayMatches(row.regions, company.region)
}

function cnaeCompatible(company: Company, row: GrantSearchIndexRow) {
  if ((row.cnae_codes ?? []).length === 0) return true
  const allCompanyCodes = [company.cnae_primary, ...(company.cnae_secondary ?? [])].filter(Boolean) as string[]
  return allCompanyCodes.some(code =>
    row.cnae_codes.some(grantCode =>
      code === grantCode || code.startsWith(grantCode.slice(0, 2)) || grantCode.startsWith(code.slice(0, 2)),
    ),
  )
}

function textScore(terms: string[], row: GrantSearchIndexRow) {
  if (terms.length === 0) return 50
  const title = normalizeText(row.title_public)
  const summary = normalizeText(row.summary_public ?? '')
  const searchText = normalizeText(row.search_text ?? '')
  const organismo = normalizeText(row.organismo ?? '')

  let score = 0
  for (const term of terms) {
    if (title.includes(term)) score += 30
    if (summary.includes(term)) score += 18
    if (searchText.includes(term)) score += 10
    if (organismo.includes(term)) score += 8
  }

  return clamp(score)
}

function businessScore(company: Company | null, row: GrantSearchIndexRow) {
  if (!company) return 55

  let score = 55
  const sizes = row.company_sizes ?? []
  if (sizes.length === 0 || sizes.includes(companySize(company)) || sizes.includes('pyme')) score += 10
  else score -= 18

  if (regionCompatible(company, row)) score += 12
  else if ((row.regions ?? []).length > 0) score -= 22

  if (cnaeCompatible(company, row)) score += 12
  else if ((row.cnae_codes ?? []).length > 0) score -= 18

  if (company.is_startup && (row.beneficiary_types ?? []).includes('startup')) score += 16
  if (!company.is_startup && (row.beneficiary_types ?? []).includes('startup')) score -= 8
  if ((row.beneficiary_types ?? []).includes('administracion')) score -= 35
  if ((row.beneficiary_types ?? []).includes('fundacion')) score -= 18

  const age = companyAgeYears(company)
  if (age !== null && (row.company_stages ?? []).includes('early_stage') && age <= 5) score += 8
  if (age !== null && (row.company_stages ?? []).includes('startup') && age > 7) score -= 8

  if (company.has_rd && arrayMatches(row.innovation_themes ?? [], 'innovacion')) score += 10
  if (company.region && normalizeText(row.territory ?? '').includes(normalizeText(company.region))) score += 6
  if ((row.budget_per_company_max ?? 0) >= 50_000) score += 4

  return clamp(score)
}

function freshnessScore(row: GrantSearchIndexRow) {
  let score = 45
  if (row.status === 'abierta') score += 25
  if (row.status === 'proxima') score += 12
  if (row.status === 'cerrada') score -= 35

  if (row.deadline) {
    const days = Math.floor((new Date(row.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    if (days < 0) score -= 25
    else if (days <= 15) score += 20
    else if (days <= 45) score += 12
    else score += 6
  }

  if (row.has_official_docs) score += 6
  if (row.official_doc_count > 1) score += 4
  return clamp(score)
}

function sourceAuthorityScore(row: GrantSearchIndexRow) {
  return clamp(row.source_priority ?? 50)
}

function matchesFilters(params: SearchParams, row: GrantSearchIndexRow) {
  if (params.minAmount > 0) {
    const ceiling = row.budget_per_company_max ?? row.budget_total ?? 0
    if (ceiling < params.minAmount) return false
  }
  if (params.beneficiary && !arrayMatches(row.beneficiary_types ?? [], params.beneficiary)) return false
  if (params.sourceLevel && row.source_level !== params.sourceLevel) return false
  if (params.territory && !arrayMatches([row.territory ?? '', ...(row.regions ?? [])], params.territory)) return false
  if (params.companyStage && !arrayMatches(row.company_stages ?? [], params.companyStage)) return false
  if (params.legalForm && !arrayMatches(row.legal_forms ?? [], params.legalForm)) return false
  if (params.quality === 'structured' && row.quality_score < 75) return false
  if (params.hasOfficialDocs && !row.has_official_docs) return false
  return true
}

function candidateToGrant(row: GrantSearchIndexRow): GrantSearchResult {
  return {
    id: row.grant_id ?? row.grant_call_id,
    external_id: row.external_id,
    title: row.title_public,
    body: row.search_text,
    organismo: row.organismo,
    source: row.source,
    source_url: row.source_url,
    publication_date: row.publication_date,
    opening_date: row.opening_date,
    deadline: row.deadline,
    budget_total: row.budget_total,
    budget_per_company_min: row.budget_per_company_min,
    budget_per_company_max: row.budget_per_company_max,
    grant_type: row.grant_type,
    scope: row.scope,
    regions: row.regions ?? [],
    sectors: row.sectors ?? [],
    cnae_codes: row.cnae_codes ?? [],
    min_employees: null,
    max_employees: null,
    min_revenue: null,
    max_revenue: null,
    min_company_age_years: null,
    requirements: [],
    eligible_expenses: [],
    required_documents: [],
    keywords: [],
    tags: row.beneficiary_types ?? [],
    status: row.status,
    difficulty_score: row.official_doc_count >= 3 ? 7 : 4,
    success_rate: null,
    summary: row.summary_public,
    raw_text: row.search_text,
    created_at: '',
    updated_at: '',
    quality_score: row.quality_score,
    publication_status: row.publication_status,
    source_level: row.source_level,
  }
}

async function resolveCompanyForUser(userId: string) {
  const admin = createAdminClient()
  const { data: userRecord } = await admin
    .from('users')
    .select('organization_id')
    .eq('id', userId)
    .single()

  if (!userRecord?.organization_id) return null

  const { data: company } = await admin
    .from('companies')
    .select('*')
    .eq('organization_id', userRecord.organization_id)
    .single()

  return company as Company | null
}

async function fetchIndexCandidates(params: SearchParams) {
  const admin = createAdminClient()
  let query = admin
    .from('grant_search_index')
    .select('*')
    .eq('publication_status', 'published')
    .limit(500)

  if (params.scope) query = query.eq('scope', params.scope)
  if (params.grantType) query = query.eq('grant_type', params.grantType)
  if (params.status) query = query.eq('status', params.status)
  if (params.sourceLevel) query = query.eq('source_level', params.sourceLevel)
  if (params.hasOfficialDocs) query = query.eq('has_official_docs', true)
  if (params.q) {
    const q = params.q.replace(/,/g, ' ')
    query = query.or(`title_public.ilike.%${q}%,summary_public.ilike.%${q}%,search_text.ilike.%${q}%`)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []) as GrantSearchIndexRow[]
}

function rankCandidates(rows: GrantSearchIndexRow[], company: Company | null, params: SearchParams) {
  const terms = tokenize(params.q)
  const ranked: RankedCandidate[] = []

  for (const row of rows) {
    if (!matchesFilters(params, row)) continue

    const text = textScore(terms, row)
    if (params.q && text === 0) continue

    const fit = businessScore(company, row)
    if (params.paraMe && company && fit < 40) continue

    const freshness = freshnessScore(row)
    const quality = clamp(row.quality_score ?? 0)
    const authority = sourceAuthorityScore(row)
    const finalScore = (fit * 0.45) + (text * 0.2) + (freshness * 0.15) + (quality * 0.15) + (authority * 0.05)
    const grant = candidateToGrant(row)

    ranked.push({
      grant: {
        ...grant,
        eligibility_score: Math.round(fit),
        potential_amount_match: grant.budget_per_company_max ?? grant.budget_total ?? undefined,
      },
      finalScore,
    })
  }

  if (params.sort === 'amount') {
    ranked.sort((a, b) => (b.grant.budget_per_company_max ?? 0) - (a.grant.budget_per_company_max ?? 0))
  } else if (params.sort === 'deadline') {
    ranked.sort((a, b) => {
      const ad = a.grant.deadline ? new Date(a.grant.deadline).getTime() : Number.MAX_SAFE_INTEGER
      const bd = b.grant.deadline ? new Date(b.grant.deadline).getTime() : Number.MAX_SAFE_INTEGER
      return ad - bd
    })
  } else if (params.sort === 'quality') {
    ranked.sort((a, b) => (b.grant.quality_score ?? 0) - (a.grant.quality_score ?? 0))
  } else if (params.sort === 'difficulty') {
    ranked.sort((a, b) => a.grant.difficulty_score - b.grant.difficulty_score)
  } else {
    ranked.sort((a, b) => {
      const byEligibility = (b.grant.eligibility_score ?? 0) - (a.grant.eligibility_score ?? 0)
      if (byEligibility !== 0) return byEligibility
      return b.finalScore - a.finalScore
    })
  }

  return ranked
}

async function fallbackGrantSearch(params: SearchParams, company: Company | null) {
  const admin = createAdminClient()
  let query = admin.from('grants').select('*')

  if (params.scope) query = query.eq('scope', params.scope)
  if (params.grantType) query = query.eq('grant_type', params.grantType)
  if (params.status) query = query.eq('status', params.status)
  if (params.minAmount > 0) query = query.gte('budget_per_company_max', params.minAmount)
  if (params.q) {
    const q = params.q.replace(/,/g, ' ')
    query = query.or(`title.ilike.%${q}%,summary.ilike.%${q}%,organismo.ilike.%${q}%`)
  }

  const { data, error } = await query.limit(300)
  if (error) throw new Error(error.message)

  return ((data ?? []) as Grant[]).map(grant => ({
    grant: {
      ...grant,
      eligibility_score: company ? 50 : undefined,
      potential_amount_match: grant.budget_per_company_max ?? grant.budget_total ?? undefined,
    },
    finalScore: 0,
  }))
}

export async function searchGrantsForUser(userId: string, params: SearchParams) {
  const company = await resolveCompanyForUser(userId)
  let ranked: RankedCandidate[]

  try {
    const rows = await fetchIndexCandidates(params)
    ranked = rankCandidates(rows, company, params)
  } catch {
    ranked = await fallbackGrantSearch(params, company)
  }

  const total = ranked.length
  const from = params.page * params.pageSize
  const to = from + params.pageSize
  const grants = ranked.slice(from, to).map(item => item.grant)
  const matchCount = ranked.filter(item => (item.grant.eligibility_score ?? 0) >= 40).length

  return {
    grants,
    total,
    page: params.page,
    hasMore: total > to,
    matchCount: company ? matchCount : undefined,
  }
}
