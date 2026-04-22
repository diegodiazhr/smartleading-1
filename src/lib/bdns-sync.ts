import { createHash } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchSourceDocumentSnapshot, persistGrantArtifacts } from '@/lib/grant-pipeline'
import type { Json } from '@/lib/types'

const BASE_URL = (
  process.env.INFOSUBVENCIONES_API_BASE_URL ??
  'https://www.infosubvenciones.es/bdnstrans/api'
).replace(/\/+$/, '')

// VPD = Portal identifier in the BDNS system.
// GE is the master portal (Administración General del Estado) and aggregates ALL grants
// from every level: nacional, autonómico, local, and europeo. Individual CCAA VPD codes
// are not exposed publicly via the API — GE is the single source of truth.
export const SPAIN_VPDS = [
  { code: 'GE', name: 'Base de Datos Nacional de Subvenciones (BDNS)' },
]

// ── Types ──────────────────────────────────────────────────────────────────

interface ConvocatoriaListItem {
  numeroConvocatoria: string
  descripcion: string | null
  descripcionLeng: string | null
  fechaRecepcion: string | null
  mrr: boolean | null
  nivel1: string | null
  nivel2: string | null
  nivel3: string | null
}

interface ConvocatoriaDetail {
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

interface ConvocatoriaListResponse {
  content: ConvocatoriaListItem[]
  totalElements?: number
  totalPages?: number
  last?: boolean
}

export interface SyncOptions {
  /** VPD codes to sync. Defaults to all SPAIN_VPDS. */
  vpds?: string[]
  /** Max pages fetched per VPD. Defaults to 20 (20×50 = 1.000 grants). */
  maxPagesPerVpd?: number
  /** Grants per page (1–50). Defaults to 50. */
  pageSize?: number
  /** Milliseconds between page requests per VPD. Defaults to 200. */
  delayBetweenPagesMs?: number
  /** Persist canonical pipeline tables besides the flat grants table. */
  persistArtifacts?: boolean
  /** Fetch and store the linked official source document when available. */
  fetchSourceDocuments?: boolean
}

export interface VpdSyncResult {
  vpd: string
  name: string
  pagesProcessed: number
  grantsUpserted: number
  artifactsPersisted: number
  sourceDocumentsFetched: number
  error?: string
}

export interface SyncStats {
  vpdsProcessed: number
  vpdsErrored: number
  vpdsSkipped: number
  totalGrantsUpserted: number
  totalPagesProcessed: number
  totalArtifactsPersisted: number
  totalSourceDocumentsFetched: number
  durationMs: number
  startedAt: string
  completedAt: string
  warnings: string[]
  vpds: VpdSyncResult[]
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** Deterministic UUID v4-shaped string from BDNS grant number (stable across syncs). */
function bdnsId(numConv: string): string {
  const h = createHash('md5').update(`bdns-${numConv}`).digest('hex')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`
}

async function fetchJson<T>(url: string, timeoutMs = 12000): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: controller.signal,
    })
    if (!res.ok) throw new Error(`http_${res.status}`)
    return await res.json() as T
  } finally {
    clearTimeout(timer)
  }
}

function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms))
}

/**
 * Parse BDNS tiposBeneficiarios into stable tag strings.
 *
 * Tags are prefixed with "ben:" so matching/search can reliably detect them:
 *   ben:empresa      — private companies, SMEs, autónomos can apply
 *   ben:startup      — startups/emprendedores explicitly named
 *   ben:administracion — only public bodies; private companies are excluded
 *   ben:fundacion    — only non-profits/foundations; private companies are excluded
 *
 * When the list is empty we don't add any tag (unknown → neutral).
 */
function parseBeneficiaryTags(
  beneficiarios: Array<{ descripcion: string | null }> | null | undefined,
): string[] {
  if (!beneficiarios || beneficiarios.length === 0) return []
  const descs = beneficiarios.map(b => (b.descripcion ?? '').toLowerCase())
  const tags: string[] = []

  const hasPrivate = descs.some(d =>
    d.includes('empresa') || d.includes('pyme') || d.includes('micropyme') ||
    d.includes('autónom') || d.includes('autonomo') || d.includes('persona física') ||
    d.includes('persona fisica') || d.includes('entidad privada') ||
    d.includes('sociedad') || d.includes('cooperativa'),
  )
  const hasStartup = descs.some(d =>
    d.includes('startup') || d.includes('emprendedor') || d.includes('nueva empresa'),
  )
  const hasPublicOnly = !hasPrivate && descs.some(d =>
    d.includes('administrac') || d.includes('entidad local') || d.includes('ayuntamiento') ||
    d.includes('diputacion') || d.includes('diputación') || d.includes('comunidad autónoma') ||
    d.includes('organismo público') || d.includes('universidad pública') || d.includes('universidad publica'),
  )
  const hasNonProfitOnly = !hasPrivate && descs.some(d =>
    d.includes('fundac') || d.includes('asociac') || d.includes('sin ánimo de lucro') ||
    d.includes('sin animo de lucro') || d.includes('ong') || d.includes('entidad sin fines'),
  )

  if (hasPublicOnly) tags.push('ben:administracion')
  if (hasNonProfitOnly) tags.push('ben:fundacion')
  if (hasPrivate) tags.push('ben:empresa')
  if (hasStartup) tags.push('ben:startup')

  return tags
}

function normalizeScope(v: string | null | undefined): 'nacional' | 'autonomico' | 'europeo' | 'municipal' {
  const s = (v ?? '').toUpperCase()
  if (s.includes('ESTATAL') || s.includes('NACIONAL')) return 'nacional'
  if (s.includes('AUTONOM')) return 'autonomico'
  if (s.includes('EUROPE')) return 'europeo'
  return 'municipal'
}

function inferGrantType(instrumentos: ConvocatoriaDetail['instrumentos']): 'fondo_perdido' | 'prestamo' | 'mixto' | 'aval' | 'bonificacion' {
  const text = (instrumentos ?? []).map(i => (i.descripcion ?? '').toLowerCase()).join(' ')
  if (text.includes('préstamo') || text.includes('prestamo')) return 'prestamo'
  if (text.includes('bonific')) return 'bonificacion'
  if (text.includes('aval')) return 'aval'
  return 'fondo_perdido'
}

function inferStatus(
  abierto: boolean | null,
  openDate: string | null,
  deadline: string | null,
): 'abierta' | 'proxima' | 'cerrada' | 'archivada' {
  if (abierto === true) return 'abierta'
  if (abierto === false) return 'cerrada'
  const now = Date.now()
  const openMs = openDate ? Date.parse(openDate) : NaN
  const deadMs = deadline ? Date.parse(deadline) : NaN
  if (!Number.isNaN(openMs) && openMs > now) return 'proxima'
  if (!Number.isNaN(deadMs) && deadMs < now) return 'cerrada'
  return 'abierta'
}

function normalizeUrl(url: string): string {
  return url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`
}

function mapToRow(item: ConvocatoriaListItem, detail: ConvocatoriaDetail | null, vpd: string) {
  const num = item.numeroConvocatoria
  const now = new Date().toISOString()
  const openingDate = detail?.fechaInicioSolicitud ?? null
  const deadline = detail?.fechaFinSolicitud ?? null

  const organismo =
    detail?.organo?.nivel3 ?? item.nivel3 ??
    detail?.organo?.nivel2 ?? item.nivel2 ??
    detail?.organo?.nivel1 ?? item.nivel1 ?? null

  const sourceUrl = detail?.urlBasesReguladoras
    ? normalizeUrl(detail.urlBasesReguladoras)
    : detail?.sedeElectronica
      ? normalizeUrl(detail.sedeElectronica)
      : `https://www.infosubvenciones.es/bdnstrans/${encodeURIComponent(vpd)}/es/convocatoria/${encodeURIComponent(num)}`

  const tags = [
    detail?.descripcionFinalidad?.toLowerCase() ?? null,
    (detail?.mrr || item.mrr) ? 'mrr' : null,
    ...parseBeneficiaryTags(detail?.tiposBeneficiarios),
  ].filter((v): v is string => Boolean(v))

  const summary = detail?.descripcionFinalidad
    ? `${detail.descripcionFinalidad}${detail.tipoConvocatoria ? ` · ${detail.tipoConvocatoria}` : ''}`
    : null

  return {
    id: bdnsId(num),
    external_id: num,
    title: item.descripcion || item.descripcionLeng || `Convocatoria ${num}`,
    body: detail?.descripcionBasesReguladoras ?? null,
    organismo,
    source: 'bdns' as const,
    source_url: sourceUrl,
    publication_date: detail?.fechaRecepcion ?? item.fechaRecepcion ?? null,
    opening_date: openingDate,
    deadline,
    budget_total: detail?.presupuestoTotal ?? null,
    budget_per_company_min: null,
    budget_per_company_max: null,
    grant_type: inferGrantType(detail?.instrumentos ?? null),
    scope: normalizeScope(detail?.organo?.nivel1 ?? item.nivel1),
    regions: (detail?.regiones ?? []).map(r => r.descripcion ?? '').filter(Boolean),
    sectors: (detail?.sectores ?? []).map(s => s.descripcion ?? '').filter(Boolean),
    cnae_codes: (detail?.sectores ?? []).map(s => s.codigo ?? '').filter(Boolean),
    min_employees: null,
    max_employees: null,
    min_revenue: null,
    max_revenue: null,
    min_company_age_years: null,
    requirements: [],
    eligible_expenses: [],
    required_documents: [],
    keywords: [],
    tags,
    status: inferStatus(detail?.abierto ?? null, openingDate, deadline),
    difficulty_score: 5,
    success_rate: null,
    summary,
    raw_text: null,
    created_at: now,
    updated_at: now,
  }
}

async function persistPipelineArtifacts(
  row: ReturnType<typeof mapToRow>,
  detail: ConvocatoriaDetail | null,
  opts: Required<Pick<SyncOptions, 'persistArtifacts' | 'fetchSourceDocuments'>>,
) {
  if (!opts.persistArtifacts) return { persisted: false, sourceFetched: false, warning: null as string | null }

  let sourceSnapshot = null
  let sourceFetched = false

  if (opts.fetchSourceDocuments && row.source_url) {
    try {
      sourceSnapshot = await fetchSourceDocumentSnapshot(row.source_url)
      sourceFetched = true
    } catch (err) {
      return {
        persisted: false,
        sourceFetched: false,
        warning: `No se pudo descargar ${row.source_url}: ${err instanceof Error ? err.message : 'unknown_error'}`,
      }
    }
  }

  try {
    await persistGrantArtifacts({
      grantId: row.id,
      externalId: row.external_id,
      title: row.title,
      summary: row.summary,
      body: row.body,
      organismo: row.organismo,
      source: row.source,
      sourceUrl: row.source_url,
      publicationDate: row.publication_date,
      openingDate: row.opening_date,
      deadline: row.deadline,
      status: row.status,
      grantType: row.grant_type,
      scope: row.scope,
      regions: row.regions,
      sectors: row.sectors,
      cnaeCodes: row.cnae_codes,
      tags: row.tags,
      budgetTotal: row.budget_total,
      budgetPerCompanyMin: row.budget_per_company_min,
      budgetPerCompanyMax: row.budget_per_company_max,
      minEmployees: row.min_employees,
      maxEmployees: row.max_employees,
      minRevenue: row.min_revenue,
      maxRevenue: row.max_revenue,
      minCompanyAgeYears: row.min_company_age_years,
      requirements: Array.isArray(row.requirements) ? row.requirements.map(String) : [],
      eligibleExpenses: Array.isArray(row.eligible_expenses) ? row.eligible_expenses.map(String) : [],
      requiredDocuments: Array.isArray(row.required_documents) ? row.required_documents.map(String) : [],
      rawText: row.raw_text ?? row.body ?? row.summary,
      detailJson: detail as unknown as Json,
    }, sourceSnapshot)
  } catch (err) {
    return {
      persisted: false,
      sourceFetched,
      warning: `No se pudieron persistir artefactos para ${row.external_id}: ${err instanceof Error ? err.message : 'unknown_error'}`,
    }
  }

  return { persisted: true, sourceFetched, warning: null as string | null }
}

// ── Per-VPD sync ───────────────────────────────────────────────────────────

async function syncVpd(
  vpd: string,
  name: string,
  opts: Required<SyncOptions>,
): Promise<{ result: VpdSyncResult; warnings: string[] }> {
  const result: VpdSyncResult = {
    vpd,
    name,
    pagesProcessed: 0,
    grantsUpserted: 0,
    artifactsPersisted: 0,
    sourceDocumentsFetched: 0,
  }
  const warnings: string[] = []
  const supabase = createAdminClient()

  try {
    for (let page = 0; page < opts.maxPagesPerVpd; page++) {
      const listUrl = `${BASE_URL}/convocatorias/ultimas?${new URLSearchParams({
        vpd,
        page: String(page),
        pageSize: String(opts.pageSize),
        order: 'fechaRecepcion',
        direccion: 'DESC',
      })}`

      let listResponse: ConvocatoriaListResponse
      try {
        listResponse = await fetchJson<ConvocatoriaListResponse>(listUrl)
      } catch (err) {
        result.error = err instanceof Error ? err.message : 'list_fetch_error'
        break
      }

      const items = listResponse.content ?? []
      if (items.length === 0) break

      // Fetch details in parallel batches of 10
      const detailMap = new Map<string, ConvocatoriaDetail | null>()
      for (let i = 0; i < items.length; i += 10) {
        await Promise.all(
          items.slice(i, i + 10).map(async item => {
            try {
              const url = `${BASE_URL}/convocatorias?${new URLSearchParams({
                numConv: item.numeroConvocatoria,
                vpd,
              })}`
              detailMap.set(item.numeroConvocatoria, await fetchJson<ConvocatoriaDetail>(url, 8000))
            } catch {
              detailMap.set(item.numeroConvocatoria, null)
            }
          }),
        )
      }

      const rows = items.map(item =>
        mapToRow(item, detailMap.get(item.numeroConvocatoria) ?? null, vpd),
      )

      const { data: existingGrants, error: existingError } = await supabase
        .from('grants')
        .select('id, external_id')
        .eq('source', 'bdns')
        .in('external_id', rows.map(row => row.external_id))

      if (existingError) {
        result.error = existingError.message
        break
      }

      const existingIdByExternalId = new Map<string, string>()
      for (const grant of existingGrants ?? []) {
        if (grant.external_id) existingIdByExternalId.set(grant.external_id, grant.id)
      }

      const normalizedRows = rows.map(row => ({
        ...row,
        id: existingIdByExternalId.get(row.external_id) ?? row.id,
      }))

      const { error } = await supabase.from('grants').upsert(normalizedRows, { onConflict: 'source,external_id' })
      if (error) {
        result.error = error.message
        break
      }

      const { data: persistedGrants, error: persistedError } = await supabase
        .from('grants')
        .select('id, external_id')
        .eq('source', 'bdns')
        .in('external_id', normalizedRows.map(row => row.external_id))

      if (persistedError) {
        result.error = persistedError.message
        break
      }

      const grantIdByExternalId = new Map<string, string>()
      for (const grant of persistedGrants ?? []) {
        if (grant.external_id) grantIdByExternalId.set(grant.external_id, grant.id)
      }

      result.pagesProcessed++
      result.grantsUpserted += normalizedRows.length

      for (let i = 0; i < normalizedRows.length; i += 5) {
        const chunk = normalizedRows.slice(i, i + 5)
        const chunkItems = items.slice(i, i + 5)
        const persistedResults = await Promise.all(
          chunk.map(async row => {
            const item = chunkItems.find(candidate => candidate.numeroConvocatoria === row.external_id)
            const detail = item ? detailMap.get(item.numeroConvocatoria) ?? null : null
            return persistPipelineArtifacts(
              { ...row, id: grantIdByExternalId.get(row.external_id) ?? row.id },
              detail,
              opts,
            )
          }),
        )

        for (const persisted of persistedResults) {
          if (persisted.persisted) result.artifactsPersisted++
          if (persisted.sourceFetched) result.sourceDocumentsFetched++
          if (persisted.warning) warnings.push(persisted.warning)
        }
      }

      if (listResponse.last) break
      if (page < opts.maxPagesPerVpd - 1) await sleep(opts.delayBetweenPagesMs)
    }
  } catch (err) {
    result.error = err instanceof Error ? err.message : 'unknown_error'
  }

  return { result, warnings }
}

// ── Public API ─────────────────────────────────────────────────────────────

export async function syncBDNS(options: SyncOptions = {}): Promise<SyncStats> {
  const vpdsToSync = (options.vpds ?? SPAIN_VPDS.map(v => v.code))
    .map(code => SPAIN_VPDS.find(v => v.code === code) ?? { code, name: code })

  const opts: Required<SyncOptions> = {
    vpds: vpdsToSync.map(v => v.code),
    maxPagesPerVpd: options.maxPagesPerVpd ?? 20,
    pageSize: Math.min(50, Math.max(1, options.pageSize ?? 50)),
    delayBetweenPagesMs: options.delayBetweenPagesMs ?? 200,
    persistArtifacts: options.persistArtifacts ?? true,
    fetchSourceDocuments: options.fetchSourceDocuments ?? false,
  }

  const startedAt = new Date().toISOString()
  const startMs = Date.now()
  const results: VpdSyncResult[] = []
  const warnings: string[] = []

  for (const vpd of vpdsToSync) {
    const { result, warnings: vpdWarnings } = await syncVpd(vpd.code, vpd.name, opts)
    results.push(result)
    warnings.push(...vpdWarnings)
    await sleep(150) // brief pause between VPDs
  }

  return {
    vpdsProcessed: results.filter(r => !r.error && r.pagesProcessed > 0).length,
    vpdsErrored: results.filter(r => !!r.error).length,
    vpdsSkipped: results.filter(r => !r.error && r.pagesProcessed === 0).length,
    totalGrantsUpserted: results.reduce((s, r) => s + r.grantsUpserted, 0),
    totalPagesProcessed: results.reduce((s, r) => s + r.pagesProcessed, 0),
    totalArtifactsPersisted: results.reduce((s, r) => s + r.artifactsPersisted, 0),
    totalSourceDocumentsFetched: results.reduce((s, r) => s + r.sourceDocumentsFetched, 0),
    durationMs: Date.now() - startMs,
    startedAt,
    completedAt: new Date().toISOString(),
    warnings,
    vpds: results,
  }
}

/** Query last sync metadata from the grants table (no extra DB table needed). */
export async function getBdnsSyncStatus() {
  const supabase = createAdminClient()

  const [{ data: latest }, { count }] = await Promise.all([
    supabase
      .from('grants')
      .select('updated_at')
      .eq('source', 'bdns')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single(),
    supabase
      .from('grants')
      .select('*', { count: 'exact', head: true })
      .eq('source', 'bdns'),
  ])

  return {
    lastSyncAt: latest?.updated_at ?? null,
    totalGrants: count ?? 0,
  }
}
