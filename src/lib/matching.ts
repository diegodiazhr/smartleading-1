import { createHash } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Company, Grant } from '@/lib/types'

export interface MatchResult {
  id: string
  company_id: string
  grant_id: string
  eligibility_score: number
  fit_score: number
  success_probability: number
  potential_amount: number
  urgency_score: number
  rejection_risks: string[]
  recommendations: string[]
  is_dismissed: boolean
  is_saved: boolean
  last_calculated: string
  created_at: string
}

export interface MatchStats {
  totalGrants: number
  matched: number        // score >= 40
  highFit: number        // score >= 70
  totalPotential: number
  durationMs: number
}

function matchId(companyId: string, grantId: string): string {
  const h = createHash('md5').update(`match-${companyId}-${grantId}`).digest('hex')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`
}

function regionMatch(companyRegion: string | null, grantRegions: string[]): boolean {
  if (!grantRegions || grantRegions.length === 0) return true // national/no restriction
  if (!companyRegion) return false
  const region = companyRegion.toLowerCase()
  return grantRegions.some(r => r.toLowerCase().includes(region) || region.includes(r.toLowerCase()))
}

function cnaeMatch(
  primary: string | null,
  secondary: string[],
  grantCnaes: string[],
): 'primary' | 'secondary' | 'none' | 'unrestricted' {
  if (!grantCnaes || grantCnaes.length === 0) return 'unrestricted'
  if (primary && grantCnaes.includes(primary)) return 'primary'
  if (secondary.some(c => grantCnaes.includes(c))) return 'secondary'
  return 'none'
}

export function calculateMatch(company: Company, grant: Grant): MatchResult {
  const now = new Date().toISOString()
  let score = 45
  const risks: string[] = []
  const recs: string[] = []

  // ── Region ────────────────────────────────────────────────────────────────
  if (grant.regions && grant.regions.length > 0) {
    if (regionMatch(company.region, grant.regions)) {
      score += 20
    } else {
      score -= 15
      risks.push('Tu región podría no ser elegible para esta convocatoria.')
    }
  } else {
    score += 8 // no region restriction is a plus
  }

  // ── CNAE ──────────────────────────────────────────────────────────────────
  const cnaeResult = cnaeMatch(company.cnae_primary, company.cnae_secondary, grant.cnae_codes)
  if (cnaeResult === 'primary') {
    score += 20
  } else if (cnaeResult === 'secondary') {
    score += 10
  } else if (cnaeResult === 'unrestricted') {
    score += 5
  } else {
    score -= 10
    risks.push('Tu actividad principal (CNAE) puede no estar contemplada en esta convocatoria.')
    recs.push('Revisa los sectores elegibles en las bases reguladoras.')
  }

  // ── Employee size ─────────────────────────────────────────────────────────
  if (grant.min_employees !== null && company.employees_count < grant.min_employees) {
    score -= 15
    risks.push(`Esta convocatoria requiere un mínimo de ${grant.min_employees} empleados.`)
  }
  if (grant.max_employees !== null && company.employees_count > grant.max_employees) {
    score -= 15
    risks.push(`Límite de ${grant.max_employees} empleados: tu empresa podría no ser elegible.`)
  }
  if (grant.min_employees === null && grant.max_employees === null) {
    score += 5 // no size restriction
  }

  // ── Revenue ───────────────────────────────────────────────────────────────
  if (grant.min_revenue !== null && company.revenue_annual < grant.min_revenue) {
    score -= 10
    risks.push('Tu facturación puede estar por debajo del mínimo requerido.')
  }
  if (grant.max_revenue !== null && company.revenue_annual > grant.max_revenue) {
    score -= 10
    risks.push('Tu facturación puede superar el límite de esta convocatoria.')
  }

  // ── Company age ───────────────────────────────────────────────────────────
  if (grant.min_company_age_years !== null && company.founding_date) {
    const ageYears = (Date.now() - new Date(company.founding_date).getTime()) / (1000 * 60 * 60 * 24 * 365)
    if (ageYears < grant.min_company_age_years) {
      score -= 10
      risks.push(`Esta convocatoria requiere empresas con al menos ${grant.min_company_age_years} años de antigüedad.`)
    }
  }

  // ── Tax / social security debts ───────────────────────────────────────────
  if (company.has_tax_debts || company.has_social_security_debts) {
    score -= 25
    risks.push('Las deudas con Hacienda o la Seguridad Social impiden obtener subvenciones.')
    recs.push('Regulariza tu situación fiscal antes de presentar cualquier solicitud.')
  } else {
    score += 5
  }

  // ── Startup/innovation tags ───────────────────────────────────────────────
  if (company.is_startup && grant.tags?.some(t => ['startup', 'emprendimiento', 'innovación'].includes(t))) {
    score += 8
  }
  if (company.has_rd && grant.tags?.some(t => ['I+D', 'investigación', 'innovación'].includes(t))) {
    score += 8
  }
  if (company.export_percentage > 10 && grant.tags?.some(t => ['internacionalización', 'exportación'].includes(t))) {
    score += 8
  }

  // ── Urgency ───────────────────────────────────────────────────────────────
  let urgencyScore = 30
  if (grant.deadline) {
    const daysLeft = (new Date(grant.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    if (daysLeft <= 0) urgencyScore = 0
    else if (daysLeft <= 15) urgencyScore = 100
    else if (daysLeft <= 30) urgencyScore = 80
    else if (daysLeft <= 60) urgencyScore = 55
    else urgencyScore = 30
  }

  const finalScore = Math.max(0, Math.min(100, Math.round(score)))

  return {
    id: matchId(company.id, grant.id),
    company_id: company.id,
    grant_id: grant.id,
    eligibility_score: finalScore,
    fit_score: finalScore,
    success_probability: Math.max(0, finalScore - 10),
    potential_amount: grant.budget_per_company_max ?? grant.budget_total ?? 0,
    urgency_score: urgencyScore,
    rejection_risks: risks,
    recommendations: recs,
    is_dismissed: false,
    is_saved: false,
    last_calculated: now,
    created_at: now,
  }
}

export async function runMatching(companyId: string): Promise<MatchStats> {
  const startMs = Date.now()
  const supabase = createAdminClient()

  const [{ data: company }, { data: grants }] = await Promise.all([
    supabase.from('companies').select('*').eq('id', companyId).single(),
    supabase
      .from('grants')
      .select('*')
      .in('status', ['abierta', 'proxima'])
      .limit(1000),
  ])

  if (!company || !grants) throw new Error('Company or grants not found')

  const matches = grants.map(grant => calculateMatch(company as Company, grant as Grant))

  // Upsert in batches of 100
  for (let i = 0; i < matches.length; i += 100) {
    const batch = matches.slice(i, i + 100)
    const { error } = await supabase
      .from('company_grant_matches')
      .upsert(batch, { onConflict: 'id' })
    if (error) throw new Error(`Upsert error: ${error.message}`)
  }

  const matched = matches.filter(m => m.eligibility_score >= 40).length
  const highFit = matches.filter(m => m.eligibility_score >= 70).length
  const totalPotential = matches
    .filter(m => m.eligibility_score >= 40)
    .reduce((s, m) => s + m.potential_amount, 0)

  return {
    totalGrants: grants.length,
    matched,
    highFit,
    totalPotential,
    durationMs: Date.now() - startMs,
  }
}
