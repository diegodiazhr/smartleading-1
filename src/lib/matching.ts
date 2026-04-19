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
  matched: number
  highFit: number
  totalPotential: number
  durationMs: number
}

function matchId(companyId: string, grantId: string): string {
  const h = createHash('md5').update(`match-${companyId}-${grantId}`).digest('hex')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`
}

function regionMatch(companyRegion: string | null, grantRegions: string[]): boolean {
  if (!grantRegions || grantRegions.length === 0) return true
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
  // Check 2-digit prefix match (e.g. company CNAE 6201 matches grant CNAE 62xx)
  if (primary) {
    const prefix = primary.slice(0, 2)
    if (grantCnaes.some(c => c.startsWith(prefix))) return 'secondary'
  }
  return 'none'
}

/** Map a CNAE code prefix to a plain-text sector keyword used in BDNS sector descriptions. */
function cnaeToSectorKeywords(cnae: string | null): string[] {
  if (!cnae) return []
  const n = parseInt(cnae.slice(0, 2), 10)
  if (n >= 1 && n <= 3) return ['agr', 'agrícol', 'ganadería', 'pesca']
  if (n >= 5 && n <= 9) return ['minerí', 'extrac']
  if (n >= 10 && n <= 33) return ['industri', 'manufactur', 'fabricac']
  if (n >= 35 && n <= 39) return ['energí', 'agua', 'residuos', 'electric']
  if (n >= 41 && n <= 43) return ['construcc', 'edificac', 'obra', 'inmobili']
  if (n >= 45 && n <= 47) return ['comerci', 'venta', 'distribuc']
  if (n >= 49 && n <= 53) return ['transport', 'logístic', 'almacen']
  if (n >= 55 && n <= 56) return ['hostelería', 'restaurac', 'turism', 'alojamient']
  if (n >= 58 && n <= 63) return ['tecnolog', 'informátic', 'digital', 'software', 'comunicac', 'TIC']
  if (n >= 64 && n <= 66) return ['financier', 'bancari', 'seguro']
  if (n === 68) return ['inmobili', 'construcc']
  if (n >= 69 && n <= 75) return ['profesion', 'consultor', 'juridic', 'contab', 'arquitect', 'ingenier', 'investig']
  if (n >= 77 && n <= 82) return ['administrat', 'servicio', 'gestión']
  if (n === 85) return ['educac', 'formac', 'enseñanz']
  if (n >= 86 && n <= 88) return ['sanidad', 'salud', 'médic', 'social']
  if (n >= 90 && n <= 93) return ['ocio', 'cultura', 'deport', 'arte']
  return []
}

function sectorMatch(company: Company, grantSectors: string[]): 'match' | 'mismatch' | 'unknown' {
  if (!grantSectors || grantSectors.length === 0) return 'unknown'
  const sectorText = grantSectors.join(' ').toLowerCase()

  // Broad "general" grants - no sector restriction
  if (
    sectorText.includes('todos') || sectorText.includes('general') ||
    sectorText.includes('multisectorial') || sectorText.includes('cualquier actividad')
  ) return 'unknown'

  // Check if company's CNAE keywords appear in sector descriptions
  const keywords = [
    ...cnaeToSectorKeywords(company.cnae_primary),
    ...company.cnae_secondary.flatMap(c => cnaeToSectorKeywords(c)),
  ]
  if (keywords.length === 0) return 'unknown'

  if (keywords.some(kw => sectorText.includes(kw.toLowerCase()))) return 'match'
  return 'mismatch'
}

export function calculateMatch(company: Company, grant: Grant): MatchResult {
  const now = new Date().toISOString()
  const risks: string[] = []
  const recs: string[] = []

  const benTags = grant.tags ?? []
  const isPublicOnly = benTags.includes('ben:administracion') && !benTags.includes('ben:empresa')
  const isNonProfitOnly = benTags.includes('ben:fundacion') && !benTags.includes('ben:empresa')

  // ── Hard exclusions: grants the company literally cannot apply to ──────────
  if (isPublicOnly || isNonProfitOnly) {
    const reason = isPublicOnly
      ? 'Esta convocatoria es exclusiva para administraciones públicas.'
      : 'Esta convocatoria es exclusiva para entidades sin ánimo de lucro.'
    return {
      id: matchId(company.id, grant.id),
      company_id: company.id,
      grant_id: grant.id,
      eligibility_score: 0,
      fit_score: 0,
      success_probability: 0,
      potential_amount: 0,
      urgency_score: 0,
      rejection_risks: [reason],
      recommendations: [],
      is_dismissed: false,
      is_saved: false,
      last_calculated: now,
      created_at: now,
    }
  }

  // ── Base score ─────────────────────────────────────────────────────────────
  // Start neutral and build up from eligibility signals
  let score = 30

  // Bonus: grant explicitly targets private companies
  if (benTags.includes('ben:empresa')) score += 10

  // ── Startup signal ────────────────────────────────────────────────────────
  if (company.is_startup) {
    if (benTags.includes('ben:startup')) {
      score += 25 // perfect: grant is for startups, company is startup
    } else if (benTags.includes('ben:empresa')) {
      score += 5
    }
    if (grant.tags?.some(t => ['startup', 'emprendimiento', 'nueva empresa'].includes(t))) {
      score += 10
    }
  } else {
    // Non-startup penalised on startup-specific grants
    if (benTags.includes('ben:startup')) score -= 15
  }

  // ── Region ────────────────────────────────────────────────────────────────
  if (grant.regions && grant.regions.length > 0) {
    if (regionMatch(company.region, grant.regions)) {
      score += 18
    } else {
      score -= 20
      risks.push('Tu región podría no ser elegible para esta convocatoria.')
    }
  } else {
    score += 5 // no region restriction is a mild positive
  }

  // ── CNAE ──────────────────────────────────────────────────────────────────
  const cnaeResult = cnaeMatch(company.cnae_primary, company.cnae_secondary ?? [], grant.cnae_codes ?? [])
  if (cnaeResult === 'primary') {
    score += 20
  } else if (cnaeResult === 'secondary') {
    score += 10
  } else if (cnaeResult === 'unrestricted') {
    score += 3
  } else {
    // CNAE mismatch — but check sectors text before penalising
    const secResult = sectorMatch(company, grant.sectors ?? [])
    if (secResult === 'match') {
      score += 8 // CNAE list missing but sector text matches
    } else if (secResult === 'mismatch') {
      score -= 15
      risks.push('Tu actividad principal no encaja con los sectores elegibles de esta convocatoria.')
      recs.push('Revisa los sectores elegibles en las bases reguladoras.')
    } else {
      score -= 5 // CNAE not listed, sector unknown — slight penalty
      risks.push('Tu actividad principal (CNAE) puede no estar contemplada en esta convocatoria.')
    }
  }

  // ── Sector cross-check (when CNAE matched, confirm sector text agrees) ────
  if (cnaeResult !== 'none') {
    const secResult = sectorMatch(company, grant.sectors ?? [])
    if (secResult === 'mismatch') {
      score -= 8 // CNAE matched but sector text disagrees — reduce confidence
    }
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
    score += 3
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
      score -= 12
      risks.push(`Esta convocatoria requiere empresas con al menos ${grant.min_company_age_years} años de antigüedad.`)
    }
  }

  // ── Fiscal health ─────────────────────────────────────────────────────────
  if (company.has_tax_debts || company.has_social_security_debts) {
    score -= 30 // near-disqualifying
    risks.push('Las deudas con Hacienda o la Seguridad Social impiden obtener subvenciones.')
    recs.push('Regulariza tu situación fiscal antes de presentar cualquier solicitud.')
  } else {
    score += 5
  }

  // ── I+D / innovation ──────────────────────────────────────────────────────
  if (company.has_rd && grant.tags?.some(t => ['I+D', 'investigación', 'innovación'].includes(t))) {
    score += 10
  }

  // ── Internationalisation ─────────────────────────────────────────────────
  if (company.export_percentage > 10 && grant.tags?.some(t => ['internacionalización', 'exportación'].includes(t))) {
    score += 8
  }

  // ── Digitalization ────────────────────────────────────────────────────────
  if ((company.digitalization_level ?? 3) >= 4 && grant.tags?.some(t =>
    ['digitalización', 'digital', 'TIC'].includes(t))) {
    score += 6
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
      .limit(2000),
  ])

  if (!company || !grants) throw new Error('Company or grants not found')

  const matches = grants.map(grant => calculateMatch(company as Company, grant as Grant))

  // Only persist matches with score > 0 (skip hard-excluded grants)
  const relevant = matches.filter(m => m.eligibility_score > 0)

  for (let i = 0; i < relevant.length; i += 100) {
    const batch = relevant.slice(i, i + 100)
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
