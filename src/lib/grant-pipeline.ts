import { createHash } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Json } from '@/lib/types'
import { evaluateGrantQuality } from '@/lib/grant-quality'

export interface CanonicalGrantInput {
  grantId: string
  externalId: string | null
  title: string
  summary: string | null
  body: string | null
  organismo: string | null
  source: string
  sourceUrl: string | null
  publicationDate: string | null
  openingDate: string | null
  deadline: string | null
  status: 'abierta' | 'proxima' | 'cerrada' | 'archivada'
  grantType: 'fondo_perdido' | 'prestamo' | 'mixto' | 'aval' | 'bonificacion'
  scope: 'nacional' | 'autonomico' | 'europeo' | 'municipal'
  regions: string[]
  sectors: string[]
  cnaeCodes: string[]
  tags: string[]
  budgetTotal: number | null
  budgetPerCompanyMin: number | null
  budgetPerCompanyMax: number | null
  minEmployees: number | null
  maxEmployees: number | null
  minRevenue: number | null
  maxRevenue: number | null
  minCompanyAgeYears: number | null
  requirements: string[]
  eligibleExpenses: string[]
  requiredDocuments: string[]
  rawText: string | null
  detailJson?: Json
}

export interface SourceDocumentSnapshot {
  url: string
  status: number | null
  contentType: string | null
  bodyText: string | null
  bodyJson: Json
  metadata: Json
}

function hash(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

function stableId(prefix: string, value: string) {
  const h = hash(`${prefix}:${value}`)
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`
}

function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120)
}

function normalizeWhitespace(value: string | null | undefined) {
  return (value ?? '').replace(/\s+/g, ' ').trim()
}

function normalizeArray(values: Array<string | null | undefined>) {
  return [...new Set(values.map(v => normalizeWhitespace(v)).filter(Boolean))]
}

function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

function inferCompanySizes(tags: string[], minEmployees: number | null, maxEmployees: number | null) {
  const sizes: string[] = []
  const hasPymeTag = tags.some(tag => /pyme|startup|autonom/.test(tag))
  if (hasPymeTag) sizes.push('pyme')
  if (minEmployees !== null || maxEmployees !== null) {
    if ((maxEmployees ?? 9) <= 9) sizes.push('micro')
    if ((minEmployees ?? 0) <= 49 && (maxEmployees ?? 49) <= 49) sizes.push('small')
    if ((minEmployees ?? 0) <= 249 && (maxEmployees ?? 249) <= 249) sizes.push('medium')
    if ((minEmployees ?? 250) >= 250) sizes.push('large')
  }
  return normalizeArray(sizes)
}

function inferBeneficiaryTypes(tags: string[], requirements: string[]) {
  const lowerRequirements = requirements.join(' ').toLowerCase()
  const beneficiaryTypes: string[] = []
  if (tags.includes('ben:empresa') || /empresa|pyme|autonom/.test(lowerRequirements)) beneficiaryTypes.push('empresa')
  if (tags.includes('ben:startup') || /startup|emprendedor/.test(lowerRequirements)) beneficiaryTypes.push('startup')
  if (tags.includes('ben:autonomo') || /aut[oó]nom/.test(lowerRequirements)) beneficiaryTypes.push('autonomo')
  if (tags.includes('ben:cooperativa') || /cooperativ/.test(lowerRequirements)) beneficiaryTypes.push('cooperativa')
  if (tags.includes('ben:cluster') || /\bcluster\b/.test(lowerRequirements)) beneficiaryTypes.push('cluster')
  if (tags.includes('ben:administracion')) beneficiaryTypes.push('administracion')
  if (tags.includes('ben:fundacion')) beneficiaryTypes.push('fundacion')
  return normalizeArray(beneficiaryTypes)
}

function inferCompanyStages(tags: string[], requirements: string[], minCompanyAgeYears: number | null, rawText: string) {
  const lower = `${tags.join(' ')} ${requirements.join(' ')} ${rawText}`.toLowerCase()
  const stages: string[] = []
  if (/startup|emprended/.test(lower)) stages.push('startup')
  if (/seed|fase inicial|primeros a[nñ]os/.test(lower) || (minCompanyAgeYears !== null && minCompanyAgeYears <= 3)) {
    stages.push('early_stage')
  }
  if (/growth|crecimiento|expansi[oó]n/.test(lower)) stages.push('growth')
  if (/scaleup|escalad/.test(lower)) stages.push('scaleup')
  if (stages.length === 0) stages.push('consolidated')
  return normalizeArray(stages)
}

function inferLegalForms(tags: string[], requirements: string[], rawText: string) {
  const lower = `${tags.join(' ')} ${requirements.join(' ')} ${rawText}`.toLowerCase()
  const legalForms: string[] = []
  if (/\bsl\b|sociedad limitada/.test(lower)) legalForms.push('sl')
  if (/\bsa\b|sociedad an[oó]nima/.test(lower)) legalForms.push('sa')
  if (/aut[oó]nom/.test(lower)) legalForms.push('autonomo')
  if (/cooperativ/.test(lower)) legalForms.push('cooperativa')
  if (/asociaci[oó]n/.test(lower)) legalForms.push('asociacion')
  if (/fundaci[oó]n/.test(lower)) legalForms.push('fundacion')
  return normalizeArray(legalForms)
}

function inferInnovationThemes(tags: string[], rawText: string) {
  const lower = `${tags.join(' ')} ${rawText}`.toLowerCase()
  const themes: string[] = []
  if (/i\+d|investigaci[oó]n|innovaci[oó]n/.test(lower)) themes.push('innovacion')
  if (/digital|tic|software|ia|automatiz/.test(lower)) themes.push('digitalizacion')
  if (/sostenib|energ[ií]a|descarboniz|verde|medioambient/.test(lower)) themes.push('sostenibilidad')
  if (/internacional|exportaci[oó]n|mercados exteriores/.test(lower)) themes.push('internacionalizacion')
  if (/industr/i.test(lower)) themes.push('industria')
  if (/empleo|contrataci[oó]n|talento/.test(lower)) themes.push('empleo')
  return normalizeArray(themes)
}

function inferApplicationChannel(sourceUrl: string | null) {
  if (!sourceUrl) return null
  const value = sourceUrl.toLowerCase()
  if (value.includes('sede')) return 'sede_electronica'
  if (value.endsWith('.pdf')) return 'pdf'
  if (value.includes('boe.es') || value.includes('dogc') || value.includes('boja') || value.includes('bop')) {
    return 'diario_oficial'
  }
  return 'web'
}

function extractPercent(rawText: string) {
  const match = rawText.match(/(\d{1,3})(?:[.,]\d+)?\s?%/i)
  return match ? Number.parseInt(match[1], 10) : null
}

function extractRegulation(rawText: string, type: 'minimis' | 'stateAid') {
  const lower = rawText.toLowerCase()
  if (type === 'minimis') {
    const match = lower.match(/reglamento\s*\(ue\)\s*(?:n[.ºo]*\s*)?(\d{4}\/\d{3,4})[^.]{0,120}minimis/i)
    return match ? `Reglamento (UE) ${match[1]}` : null
  }
  const match = lower.match(/reglamento\s*\(ue\)\s*(?:n[.ºo]*\s*)?(\d{4}\/\d{3,4})/i)
  return match ? `Reglamento (UE) ${match[1]}` : null
}

function extractEvidenceText(rawText: string | null, needle: string) {
  if (!rawText) return null
  const index = rawText.toLowerCase().indexOf(needle.toLowerCase())
  if (index === -1) return null
  const start = Math.max(0, index - 120)
  const end = Math.min(rawText.length, index + needle.length + 120)
  return rawText.slice(start, end).trim()
}

export async function fetchSourceDocumentSnapshot(url: string): Promise<SourceDocumentSnapshot> {
  const res = await fetch(url, {
    headers: { Accept: 'text/html,application/json,text/plain,application/pdf;q=0.9,*/*;q=0.8' },
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
  })

  const contentType = res.headers.get('content-type')
  const body = await res.text()
  const bodyJson =
    contentType?.includes('json')
      ? (() => {
          try {
            return JSON.parse(body) as Json
          } catch {
            return null
          }
        })()
      : null

  const bodyText =
    contentType?.includes('html')
      ? stripHtml(body)
      : contentType?.includes('json')
        ? JSON.stringify(bodyJson)
        : contentType?.includes('text') || !contentType
          ? body
          : null

  return {
    url,
    status: res.status,
    contentType,
    bodyText: normalizeWhitespace(bodyText),
    bodyJson,
    metadata: {
      final_url: res.url,
      content_length: body.length,
    },
  }
}

export function buildGrantArtifacts(input: CanonicalGrantInput) {
  const now = new Date().toISOString()
  const normalizedTitle = normalizeWhitespace(input.title)
  const programFingerprint = [
    normalizeWhitespace(input.organismo),
    slugify(normalizedTitle.replace(/\b\d{4}\b/g, '')),
    input.scope,
  ].join('|')
  const programId = stableId('grant-program', programFingerprint)
  const callId = input.grantId
  const rawText = normalizeWhitespace(input.rawText || input.body || input.summary || '')
  const dedupeKey = hash([
    input.externalId ?? '',
    slugify(normalizedTitle),
    slugify(input.organismo ?? ''),
    input.publicationDate ?? '',
  ].join('|'))
  const beneficiaryTypes = inferBeneficiaryTypes(input.tags, input.requirements)
  const companySizes = inferCompanySizes(input.tags, input.minEmployees, input.maxEmployees)
  const companyStages = inferCompanyStages(input.tags, input.requirements, input.minCompanyAgeYears, rawText)
  const legalForms = inferLegalForms(input.tags, input.requirements, rawText)
  const innovationThemes = inferInnovationThemes(input.tags, rawText)
  const minimisRegulation = extractRegulation(rawText, 'minimis')
  const stateAidRegulation = extractRegulation(rawText, 'stateAid')
  const applicationChannel = inferApplicationChannel(input.sourceUrl)
  const grantIntensityPercent = extractPercent(rawText)
  const cofinancingRequired = /\bcofinanciaci[oó]n\b|\bcofinanciad[oa]\b/i.test(rawText) ? true : null
  const anticipoAllowed = /\banticipo\b|\bpago anticipado\b/i.test(rawText) ? true : null
  const requiresNoTaxDebt = /\bobligaciones tributarias\b|\bhacienda\b/i.test(rawText) ? true : null
  const requiresNoSocialSecurityDebt = /\bseguridad social\b/i.test(rawText) ? true : null
  const requiresSpanishEstablishment = /\bespa[ñn]a\b|\bestablecid[ao]s?\s+en\s+espa[ñn]a\b/i.test(rawText) ? true : null
  const consortiumRequired = /\bconsorci[oa]\b|\bagrupaci[oó]n\b|\bagrupaciones\b/i.test(rawText) ? true : null
  const sourceRecordId = stableId('grant-source', `${callId}:detail-json`)
  const requirementsText = normalizeWhitespace(input.requirements.join(' | ')).slice(0, 800) || null
  const evidence = [
    {
      id: stableId('grant-evidence', `${callId}:budget_total`),
      grant_call_id: callId,
      field_name: 'budget_total',
      value_json: input.budgetTotal,
      source_record_id: sourceRecordId,
      source_url: input.sourceUrl,
      evidence_text: extractEvidenceText(rawText || input.summary, 'presupuesto'),
      confidence: input.budgetTotal !== null ? 0.8 : 0.2,
      last_verified_at: now,
      created_at: now,
      updated_at: now,
    },
    {
      id: stableId('grant-evidence', `${callId}:deadline`),
      grant_call_id: callId,
      field_name: 'deadline',
      value_json: input.deadline,
      source_record_id: sourceRecordId,
      source_url: input.sourceUrl,
      evidence_text: extractEvidenceText(rawText || input.summary, 'solicitud'),
      confidence: input.deadline ? 0.9 : 0.2,
      last_verified_at: now,
      created_at: now,
      updated_at: now,
    },
    {
      id: stableId('grant-evidence', `${callId}:requirements`),
      grant_call_id: callId,
      field_name: 'requirements',
      value_json: input.requirements,
      source_record_id: sourceRecordId,
      source_url: input.sourceUrl,
      evidence_text: requirementsText,
      confidence: input.requirements.length > 0 ? 0.85 : 0.25,
      last_verified_at: now,
      created_at: now,
      updated_at: now,
    },
  ]
  const primaryDocumentId = stableId('grant-call-document', `${callId}:primary`)
  const quality = evaluateGrantQuality({
    title: normalizedTitle,
    summary: input.summary,
    officialSourceUrl: input.sourceUrl,
    beneficiaryTypes,
    requirementsCount: input.requirements.length,
    hasFunding: Boolean(
      input.budgetTotal !== null ||
      input.budgetPerCompanyMin !== null ||
      input.budgetPerCompanyMax !== null ||
      grantIntensityPercent !== null
    ),
    hasTimeline: Boolean(input.deadline || input.openingDate || ['abierta', 'proxima'].includes(input.status)),
    evidenceCount: evidence.filter(item => (item.confidence ?? 0) >= 0.5 && item.evidence_text).length,
    hasPrimaryDocument: Boolean(input.sourceUrl),
    hasSourceRecord: true,
  })

  return {
    program: {
      id: programId,
      slug: slugify(`${input.organismo ?? 'programa'}-${normalizedTitle}`),
      title: normalizedTitle,
      organismo: input.organismo,
      scope: input.scope,
      source: input.source,
      source_url: input.sourceUrl,
      regions: normalizeArray(input.regions),
      sectors: normalizeArray(input.sectors),
      tags: normalizeArray(input.tags),
      canonical_hash: hash(programFingerprint),
      first_seen_at: now,
      last_seen_at: now,
      created_at: now,
      updated_at: now,
    },
    call: {
      id: callId,
      grant_program_id: programId,
      grant_id: input.grantId,
      external_id: input.externalId,
      title: normalizedTitle,
      organismo: input.organismo,
      publication_date: input.publicationDate,
      opening_date: input.openingDate,
      deadline: input.deadline,
      status: input.status,
      grant_type: input.grantType,
      scope: input.scope,
      source: input.source,
      source_url: input.sourceUrl,
      summary: input.summary,
      raw_text: rawText || null,
      dedupe_key: dedupeKey,
      publication_status: quality.publicationStatus,
      quality_score: quality.qualityScore,
      detail_completeness: quality.detailCompleteness,
      last_enriched_at: now,
      preferred_detail_source_record_id: null,
      created_at: now,
      updated_at: now,
    },
    eligibilityRule: {
      id: stableId('grant-eligibility', callId),
      grant_call_id: callId,
      beneficiary_types: beneficiaryTypes,
      company_sizes: companySizes,
      company_stages: companyStages,
      regions: normalizeArray(input.regions),
      sectors: normalizeArray(input.sectors),
      cnae_codes: normalizeArray(input.cnaeCodes),
      legal_forms: legalForms,
      min_employees: input.minEmployees,
      max_employees: input.maxEmployees,
      min_revenue: input.minRevenue,
      max_revenue: input.maxRevenue,
      min_company_age_years: input.minCompanyAgeYears,
      requires_spanish_establishment: requiresSpanishEstablishment,
      consortium_required: consortiumRequired,
      requires_no_tax_debt: requiresNoTaxDebt,
      requires_no_social_security_debt: requiresNoSocialSecurityDebt,
      minimis_regulation: minimisRegulation,
      state_aid_regulation: stateAidRegulation,
      innovation_themes: innovationThemes,
      raw_rules: {
        requirements: input.requirements,
        tags: input.tags,
      },
      created_at: now,
      updated_at: now,
    },
    fundingTerms: {
      id: stableId('grant-funding-terms', callId),
      grant_call_id: callId,
      budget_total: input.budgetTotal,
      budget_per_company_min: input.budgetPerCompanyMin,
      budget_per_company_max: input.budgetPerCompanyMax,
      grant_intensity_percent: grantIntensityPercent,
      cofinancing_required: cofinancingRequired,
      anticipo_allowed: anticipoAllowed,
      compatibility_notes: null,
      payment_modality: null,
      application_channel: applicationChannel,
      justification_deadline: null,
      raw_terms: {
        source_url: input.sourceUrl,
      },
      created_at: now,
      updated_at: now,
    },
    documentRequirements: normalizeArray(input.requiredDocuments).map(name => ({
      id: stableId('grant-document', `${callId}:${name}`),
      grant_call_id: callId,
      name,
      phase: 'application' as const,
      is_required: true,
      notes: null,
      created_at: now,
      updated_at: now,
    })),
    expenseRules: normalizeArray(input.eligibleExpenses).map(expenseType => ({
      id: stableId('grant-expense', `${callId}:${expenseType}`),
      grant_call_id: callId,
      expense_type: expenseType,
      is_eligible: true,
      notes: null,
      created_at: now,
      updated_at: now,
    })),
    evidence,
    detailSourceRecord: {
      id: sourceRecordId,
      grant_call_id: callId,
      grant_id: input.grantId,
      source: input.source,
      source_kind: 'api_json' as const,
      source_url: input.sourceUrl,
      content_type: 'application/json',
      http_status: 200,
      content_hash: input.detailJson ? hash(JSON.stringify(input.detailJson)) : null,
      content_text: rawText || null,
      content_json: input.detailJson ?? null,
      metadata: {
        external_id: input.externalId,
      },
      fetched_at: now,
      created_at: now,
    },
    callDocuments: input.sourceUrl
      ? [{
          id: primaryDocumentId,
          grant_call_id: callId,
          source_record_id: sourceRecordId,
          title: normalizedTitle,
          document_type: input.sourceUrl.toLowerCase().includes('pdf') ? 'bases' as const : 'convocatoria' as const,
          is_primary: true,
          url: input.sourceUrl,
          mime_type: 'application/json',
          content_hash: input.detailJson ? hash(JSON.stringify(input.detailJson)) : null,
          content_text: rawText || null,
          metadata: {
            source: input.source,
            quality_score: quality.qualityScore,
          },
          created_at: now,
          updated_at: now,
        }]
      : [],
    quality,
  }
}

export async function persistGrantArtifacts(
  input: CanonicalGrantInput,
  sourceSnapshot?: SourceDocumentSnapshot | null,
) {
  const supabase = createAdminClient()
  const artifacts = buildGrantArtifacts(input)

  const ensure = async (promise: PromiseLike<{ error: { message: string } | null }>) => {
    const { error } = await promise
    if (error) throw new Error(error.message)
  }

  await ensure(supabase.from('grant_programs').upsert(artifacts.program, { onConflict: 'id' }))
  await ensure(supabase.from('grant_calls').upsert(artifacts.call, { onConflict: 'id' }))
  await ensure(supabase.from('grant_eligibility_rules').upsert(artifacts.eligibilityRule, { onConflict: 'id' }))
  await ensure(supabase.from('grant_funding_terms').upsert(artifacts.fundingTerms, { onConflict: 'id' }))

  if (artifacts.documentRequirements.length > 0) {
    await ensure(supabase.from('grant_document_requirements').upsert(artifacts.documentRequirements, { onConflict: 'id' }))
  }

  if (artifacts.expenseRules.length > 0) {
    await ensure(supabase.from('grant_expense_rules').upsert(artifacts.expenseRules, { onConflict: 'id' }))
  }

  await ensure(supabase.from('grant_field_evidence').upsert(artifacts.evidence, { onConflict: 'id' }))
  await ensure(supabase.from('grant_source_records').upsert(artifacts.detailSourceRecord, { onConflict: 'id' }))

  if (artifacts.callDocuments.length > 0) {
    await ensure(supabase.from('grant_call_documents').upsert(artifacts.callDocuments, { onConflict: 'id' }))
  }

  await ensure(
    supabase.from('grant_calls').update({
      preferred_detail_source_record_id: artifacts.detailSourceRecord.id,
    }).eq('id', artifacts.call.id),
  )

  if (sourceSnapshot) {
    const snapshotSourceRecordId = stableId('grant-source', `${artifacts.call.id}:${sourceSnapshot.url}`)
    await ensure(
      supabase.from('grant_source_records').upsert({
        id: snapshotSourceRecordId,
        grant_call_id: artifacts.call.id,
        grant_id: input.grantId,
        source: input.source,
        source_kind: sourceSnapshot.contentType?.includes('html')
          ? 'html'
          : sourceSnapshot.contentType?.includes('pdf')
            ? 'pdf'
            : sourceSnapshot.contentType?.includes('xml')
              ? 'xml'
              : 'manual',
        source_url: sourceSnapshot.url,
        content_type: sourceSnapshot.contentType,
        http_status: sourceSnapshot.status,
        content_hash: sourceSnapshot.bodyText ? hash(sourceSnapshot.bodyText) : null,
        content_text: sourceSnapshot.bodyText,
        content_json: sourceSnapshot.bodyJson,
        metadata: sourceSnapshot.metadata,
        fetched_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      }, { onConflict: 'id' }),
    )

    await ensure(
      supabase.from('grant_call_documents').upsert({
        id: stableId('grant-call-document', `${artifacts.call.id}:${sourceSnapshot.url}`),
        grant_call_id: artifacts.call.id,
        source_record_id: snapshotSourceRecordId,
        title: artifacts.call.title,
        document_type: sourceSnapshot.contentType?.includes('pdf')
          ? 'bases'
          : sourceSnapshot.url.toLowerCase().includes('anexo')
            ? 'anexo'
            : 'convocatoria',
        is_primary: true,
        url: sourceSnapshot.url,
        mime_type: sourceSnapshot.contentType,
        content_hash: sourceSnapshot.bodyText ? hash(sourceSnapshot.bodyText) : null,
        content_text: sourceSnapshot.bodyText,
        metadata: sourceSnapshot.metadata,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' }),
    )

    await ensure(
      supabase.from('grant_calls').update({
        preferred_detail_source_record_id: snapshotSourceRecordId,
      }).eq('id', artifacts.call.id),
    )
  }

  return artifacts
}
