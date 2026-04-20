import OpenAI from 'openai'
import { createAdminClient } from '@/lib/supabase/admin'

// ── OpenAI client ──────────────────────────────────────────────────────────

let _ai: OpenAI | null = null
function getAI(): OpenAI {
  if (!_ai) {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) throw new Error('Missing OPENAI_API_KEY')
    _ai = new OpenAI({ apiKey })
  }
  return _ai
}

// ── infosubvenciones.es API ────────────────────────────────────────────────

const BASE_URL = (process.env.INFOSUBVENCIONES_API_BASE_URL ?? 'https://www.infosubvenciones.es/bdnstrans/api').replace(/\/+$/, '')
const DEFAULT_VPD = process.env.INFOSUBVENCIONES_VPD ?? 'GE'

export interface BDNSDetail {
  codigoBDNS: string
  descripcionFinalidad: string | null
  descripcionBasesReguladoras: string | null
  fechaInicioSolicitud: string | null
  fechaFinSolicitud: string | null
  fechaRecepcion: string | null
  presupuestoTotal: number | null
  abierto: boolean | null
  mrr: boolean | null
  sedeElectronica: string | null
  urlBasesReguladoras: string | null
  tipoConvocatoria: string | null
  organo?: { nivel1: string | null; nivel2: string | null; nivel3: string | null } | null
  instrumentos?: Array<{ descripcion: string | null }> | null
  sectores?: Array<{ descripcion: string | null; codigo?: string | null }> | null
  regiones?: Array<{ descripcion: string | null }> | null
  tiposBeneficiarios?: Array<{ descripcion: string | null }> | null
}

export async function fetchBDNSDetail(externalId: string, vpd = DEFAULT_VPD): Promise<BDNSDetail | null> {
  const url = `${BASE_URL}/convocatorias?${new URLSearchParams({ numConv: externalId, vpd }).toString()}`
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(12_000),
    })
    if (!res.ok) return null
    return await res.json() as BDNSDetail
  } catch {
    return null
  }
}

// ── AI extraction ──────────────────────────────────────────────────────────

export interface ExtractedGrantData {
  title: string
  summary: string
  body: string | null
  grant_type: 'fondo_perdido' | 'prestamo' | 'mixto' | 'aval' | 'bonificacion'
  scope: 'nacional' | 'autonomico' | 'europeo' | 'municipal'
  tags: string[]
  sectors: string[]
  cnae_codes: string[]
  regions: string[]
  budget_per_company_min: number | null
  budget_per_company_max: number | null
  min_employees: number | null
  max_employees: number | null
  min_revenue: number | null
  max_revenue: number | null
  min_company_age_years: number | null
  difficulty_score: number
  requirements: string[]
  eligible_expenses: string[]
  keywords: string[]
  opening_date: string | null
  deadline: string | null
  source_url: string | null
}

const EXTRACTION_SYSTEM = `Eres un experto en análisis de convocatorias de subvenciones públicas españolas.
Extraes información estructurada precisa a partir del texto oficial de una convocatoria.

REGLAS:
- Extrae SOLO lo que está explícito en el texto. Nunca inventes.
- Si un dato no aparece, devuelve null o array vacío según corresponda.
- Para importes: si el texto dice "hasta X€" → budget_per_company_max. "Desde X€" → min. Si hay rango, ambos.
- Para CNAE: extrae los códigos exactos si aparecen (ej: "6201", "43.1"). Si no hay códigos pero sí sector, déjalo vacío.
- Para regiones: normaliza al nombre oficial de CCAA o "Nacional" si aplica a todo el territorio.
- Para tags de beneficiarios:
  · "ben:empresa" → si pueden aplicar empresas privadas, autónomos, cooperativas, pymes
  · "ben:startup" → si se menciona startup, emprendedor, nueva empresa, empresa de reciente creación
  · "ben:administracion" → si es EXCLUSIVO para administraciones públicas
  · "ben:fundacion" → si es EXCLUSIVO para entidades sin ánimo de lucro, ONGs, fundaciones
  · Si hay mezcla (ej: empresa + fundación), incluye ambas
- Para tags temáticos añade los que apliquen: "digitalización", "I+D", "innovación", "exportación", "empleo", "formación", "sostenibilidad", "energía", "turismo", "industria", "construcción", "hostelería", "mrr"
- difficulty_score: 1 (muy fácil) a 10 (muy difícil). Basa en: documentación exigida, cofinanciación requerida, criterios técnicos, competitividad
- El campo "body" debe contener el texto completo limpio de la convocatoria (sin etiquetas HTML)
- El campo "summary" debe ser 2-3 frases orientadas al empresario: QUÉ financia, QUIÉN puede pedir, CUÁNTO se puede obtener`

async function extractWithAI(
  title: string,
  organismo: string | null,
  detail: BDNSDetail,
): Promise<ExtractedGrantData> {
  const ai = getAI()

  // Build raw text from all available fields
  const rawText = [
    `TÍTULO: ${title}`,
    `ORGANISMO: ${organismo ?? detail.organo?.nivel3 ?? detail.organo?.nivel2 ?? detail.organo?.nivel1 ?? 'No especificado'}`,
    detail.tipoConvocatoria ? `TIPO CONVOCATORIA: ${detail.tipoConvocatoria}` : null,
    detail.descripcionFinalidad ? `\nFINALIDAD:\n${detail.descripcionFinalidad}` : null,
    detail.descripcionBasesReguladoras ? `\nBASES REGULADORAS:\n${detail.descripcionBasesReguladoras.slice(0, 3000)}` : null,
    detail.sectores?.length
      ? `\nSECTORES: ${detail.sectores.map(s => [s.codigo, s.descripcion].filter(Boolean).join(': ')).join(', ')}`
      : null,
    detail.regiones?.length
      ? `\nREGIONES: ${detail.regiones.map(r => r.descripcion).filter(Boolean).join(', ')}`
      : null,
    detail.instrumentos?.length
      ? `\nINSTRUMENTOS: ${detail.instrumentos.map(i => i.descripcion).filter(Boolean).join(', ')}`
      : null,
    detail.tiposBeneficiarios?.length
      ? `\nBENEFICIARIOS: ${detail.tiposBeneficiarios.map(b => b.descripcion).filter(Boolean).join(', ')}`
      : null,
    detail.presupuestoTotal ? `\nPRESUPUESTO TOTAL: ${detail.presupuestoTotal.toLocaleString('es-ES')} €` : null,
    detail.fechaInicioSolicitud ? `INICIO SOLICITUD: ${detail.fechaInicioSolicitud}` : null,
    detail.fechaFinSolicitud ? `FIN SOLICITUD: ${detail.fechaFinSolicitud}` : null,
  ].filter(Boolean).join('\n')

  const userMessage = `Analiza esta convocatoria y extrae todos los datos en JSON:

${rawText}

Devuelve EXACTAMENTE este JSON (sin texto adicional):
{
  "title": "título mejorado máximo 10 palabras, sin siglas ni jerga legal",
  "summary": "2-3 frases para empresarios: qué financia, quién puede pedir, cuánto",
  "body": "texto completo limpio de la convocatoria",
  "grant_type": "fondo_perdido|prestamo|mixto|aval|bonificacion",
  "scope": "nacional|autonomico|europeo|municipal",
  "tags": ["ben:empresa", "digitalización", ...],
  "sectors": ["Nombre sector", ...],
  "cnae_codes": ["6201", ...],
  "regions": ["Cataluña", "Madrid", ...],
  "budget_per_company_min": null_o_numero,
  "budget_per_company_max": null_o_numero,
  "min_employees": null_o_numero,
  "max_employees": null_o_numero,
  "min_revenue": null_o_numero,
  "max_revenue": null_o_numero,
  "min_company_age_years": null_o_numero,
  "difficulty_score": 1-10,
  "requirements": ["Requisito 1", ...],
  "eligible_expenses": ["Categoría gasto 1", ...],
  "keywords": ["palabra1", ...]
}`

  const response = await ai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: EXTRACTION_SYSTEM },
      { role: 'user', content: userMessage },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.1,
    max_tokens: 2500,
  })

  const raw = response.choices[0]?.message?.content
  if (!raw) throw new Error('Empty AI response')

  const parsed = JSON.parse(raw) as Partial<ExtractedGrantData>

  return {
    title: parsed.title ?? title,
    summary: parsed.summary ?? '',
    body: parsed.body ?? detail.descripcionBasesReguladoras ?? null,
    grant_type: parsed.grant_type ?? 'fondo_perdido',
    scope: parsed.scope ?? 'nacional',
    tags: Array.isArray(parsed.tags) ? parsed.tags : [],
    sectors: Array.isArray(parsed.sectors) ? parsed.sectors : [],
    cnae_codes: Array.isArray(parsed.cnae_codes) ? parsed.cnae_codes : [],
    regions: Array.isArray(parsed.regions) ? parsed.regions : [],
    budget_per_company_min: parsed.budget_per_company_min ?? null,
    budget_per_company_max: parsed.budget_per_company_max ?? null,
    min_employees: parsed.min_employees ?? null,
    max_employees: parsed.max_employees ?? null,
    min_revenue: parsed.min_revenue ?? null,
    max_revenue: parsed.max_revenue ?? null,
    min_company_age_years: parsed.min_company_age_years ?? null,
    difficulty_score: typeof parsed.difficulty_score === 'number' ? parsed.difficulty_score : 5,
    requirements: Array.isArray(parsed.requirements) ? parsed.requirements : [],
    eligible_expenses: Array.isArray(parsed.eligible_expenses) ? parsed.eligible_expenses : [],
    keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
    // Dates come from the BDNS API, not AI
    opening_date: detail.fechaInicioSolicitud ?? null,
    deadline: detail.fechaFinSolicitud ?? null,
    source_url: detail.urlBasesReguladoras ?? detail.sedeElectronica ?? null,
  }
}

// ── Normalize URL ──────────────────────────────────────────────────────────

function normalizeUrl(url: string | null): string | null {
  if (!url) return null
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  return `https://${url}`
}

// ── Infer status from dates ────────────────────────────────────────────────

function inferStatus(
  abierto: boolean | null,
  openingDate: string | null,
  deadline: string | null,
): 'abierta' | 'proxima' | 'cerrada' {
  if (abierto === true) return 'abierta'
  if (abierto === false) return 'cerrada'
  const now = Date.now()
  if (openingDate && Date.parse(openingDate) > now) return 'proxima'
  if (deadline && Date.parse(deadline) < now) return 'cerrada'
  return 'abierta'
}

// ── Single grant enrichment ────────────────────────────────────────────────

export interface EnrichOneResult {
  grantId: string
  externalId: string
  ok: boolean
  phase?: 'bdns' | 'ai' | 'db'
  error?: string
}

export async function enrichOne(
  grantId: string,
  externalId: string,
  currentTitle: string,
  currentOrganismo: string | null,
): Promise<EnrichOneResult> {
  // 1. Fetch from infosubvenciones.es
  const detail = await fetchBDNSDetail(externalId)
  if (!detail) {
    return { grantId, externalId, ok: false, phase: 'bdns', error: 'No detail from BDNS API' }
  }

  // 2. Extract structured data with AI
  let extracted: ExtractedGrantData
  try {
    extracted = await extractWithAI(currentTitle, currentOrganismo, detail)
  } catch (err) {
    return { grantId, externalId, ok: false, phase: 'ai', error: String(err) }
  }

  // 3. Persist to database
  const admin = createAdminClient()
  const status = inferStatus(detail.abierto, extracted.opening_date, extracted.deadline)

  // Merge MRR tag from BDNS if missing from AI extraction
  const tags = [...new Set([
    ...extracted.tags,
    ...(detail.mrr ? ['mrr'] : []),
  ])]

  const { error: dbErr } = await admin
    .from('grants')
    .update({
      title: extracted.title,
      summary: extracted.summary,
      body: extracted.body,
      grant_type: extracted.grant_type,
      scope: extracted.scope,
      tags,
      sectors: extracted.sectors,
      cnae_codes: extracted.cnae_codes,
      regions: extracted.regions,
      budget_total: detail.presupuestoTotal ?? null,
      budget_per_company_min: extracted.budget_per_company_min,
      budget_per_company_max: extracted.budget_per_company_max,
      min_employees: extracted.min_employees,
      max_employees: extracted.max_employees,
      min_revenue: extracted.min_revenue,
      max_revenue: extracted.max_revenue,
      min_company_age_years: extracted.min_company_age_years,
      difficulty_score: extracted.difficulty_score,
      requirements: extracted.requirements,
      eligible_expenses: extracted.eligible_expenses,
      keywords: extracted.keywords,
      opening_date: extracted.opening_date,
      deadline: extracted.deadline,
      source_url: normalizeUrl(extracted.source_url),
      status,
      organismo: currentOrganismo
        ?? detail.organo?.nivel3
        ?? detail.organo?.nivel2
        ?? detail.organo?.nivel1
        ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', grantId)

  if (dbErr) {
    return { grantId, externalId, ok: false, phase: 'db', error: dbErr.message }
  }

  return { grantId, externalId, ok: true }
}

// ── Batch enrichment ───────────────────────────────────────────────────────

export interface BatchEnrichOptions {
  /** Max grants to process in this run */
  limit?: number
  /** Only enrich grants with no body text yet */
  onlyMissing?: boolean
  /** Specific grant IDs to enrich */
  grantIds?: string[]
}

export interface BatchEnrichResult {
  processed: number
  succeeded: number
  failed: number
  skippedNoExternalId: number
  durationMs: number
  errors: Array<{ externalId: string; phase: string; error: string }>
}

export async function enrichBatch(options: BatchEnrichOptions = {}): Promise<BatchEnrichResult> {
  const { limit = 30, onlyMissing = true, grantIds } = options
  const admin = createAdminClient()
  const startMs = Date.now()

  // Build query
  let query = admin
    .from('grants')
    .select('id, external_id, title, organismo')
    .not('external_id', 'is', null)
    .limit(limit)

  if (grantIds?.length) {
    query = query.in('id', grantIds)
  } else if (onlyMissing) {
    // Target grants with minimal data: no body or no sectors
    query = query.or('body.is.null,sectors.eq.{}')
  }

  const { data: grants, error } = await query
  if (error) throw new Error(`DB query error: ${error.message}`)
  if (!grants || grants.length === 0) {
    return { processed: 0, succeeded: 0, failed: 0, skippedNoExternalId: 0, durationMs: Date.now() - startMs, errors: [] }
  }

  const withId = grants.filter(g => g.external_id)
  const skippedNoExternalId = grants.length - withId.length

  let succeeded = 0
  let failed = 0
  const errors: BatchEnrichResult['errors'] = []

  // Process 5 at a time (API rate limits)
  const CONCURRENCY = 5
  for (let i = 0; i < withId.length; i += CONCURRENCY) {
    const chunk = withId.slice(i, i + CONCURRENCY)
    const results = await Promise.all(
      chunk.map(g => enrichOne(g.id, g.external_id!, g.title, g.organismo ?? null))
    )
    for (const r of results) {
      if (r.ok) {
        succeeded++
      } else {
        failed++
        errors.push({ externalId: r.externalId, phase: r.phase ?? 'unknown', error: r.error ?? '' })
      }
    }
  }

  return {
    processed: withId.length,
    succeeded,
    failed,
    skippedNoExternalId,
    durationMs: Date.now() - startMs,
    errors,
  }
}
