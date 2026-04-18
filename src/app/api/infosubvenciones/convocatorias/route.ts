import { NextResponse } from 'next/server'
import type { Grant } from '@/lib/types'

export const dynamic = 'force-dynamic'

const DEFAULT_VPD = process.env.INFOSUBVENCIONES_VPD ?? 'GE'
const BASE_URL = (process.env.INFOSUBVENCIONES_API_BASE_URL ?? 'https://www.infosubvenciones.es/bdnstrans/api').replace(/\/+$/, '')

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
  organo?: {
    nivel1: string | null
    nivel2: string | null
    nivel3: string | null
  } | null
  instrumentos?: Array<{ descripcion: string | null }> | null
  sectores?: Array<{ descripcion: string | null; codigo?: string | null }> | null
  regiones?: Array<{ descripcion: string | null }> | null
}

interface ConvocatoriaListResponse {
  content: ConvocatoriaListItem[]
  totalElements?: number
  totalPages?: number
  last?: boolean
  advertencia?: string
}

function normalizeScope(value: string | null | undefined): Grant['scope'] {
  const scope = (value ?? '').toUpperCase()
  if (scope.includes('ESTATAL') || scope.includes('NACIONAL')) return 'nacional'
  if (scope.includes('AUTONOM')) return 'autonomico'
  if (scope.includes('EUROPE')) return 'europeo'
  return 'municipal'
}

function inferGrantType(instrumentos: ConvocatoriaDetail['instrumentos']): Grant['grant_type'] {
  const text = (instrumentos ?? [])
    .map((i) => (i.descripcion ?? '').toLowerCase())
    .join(' ')

  if (text.includes('préstamo') || text.includes('prestamo')) return 'prestamo'
  if (text.includes('bonific')) return 'bonificacion'
  if (text.includes('aval')) return 'aval'
  return 'fondo_perdido'
}

function inferStatus(abierto: boolean | null | undefined, openingDate: string | null | undefined, deadline: string | null | undefined): Grant['status'] {
  if (abierto === true) return 'abierta'
  if (abierto === false) return 'cerrada'

  const now = Date.now()
  const openingMs = openingDate ? Date.parse(openingDate) : NaN
  const deadlineMs = deadline ? Date.parse(deadline) : NaN

  if (!Number.isNaN(openingMs) && openingMs > now) return 'proxima'
  if (!Number.isNaN(deadlineMs) && deadlineMs < now) return 'cerrada'
  return 'abierta'
}

function buildSourceUrl(detail: ConvocatoriaDetail | null, numConv: string, vpd: string): string {
  if (detail?.urlBasesReguladoras) return normalizeUrl(detail.urlBasesReguladoras)
  if (detail?.sedeElectronica) return normalizeUrl(detail.sedeElectronica)
  return `https://www.infosubvenciones.es/bdnstrans/${encodeURIComponent(vpd)}/es/convocatoria/${encodeURIComponent(numConv)}`
}

function normalizeUrl(url: string): string {
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  return `https://${url}`
}

async function fetchJson<T>(url: string, timeoutMs = 10000): Promise<T> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error(`infosubvenciones_status_${response.status}`)
    }

    return await response.json() as T
  } finally {
    clearTimeout(timeout)
  }
}

function mapToGrant(item: ConvocatoriaListItem, detail: ConvocatoriaDetail | null, vpd: string): Grant {
  const now = new Date().toISOString()
  const numeroConvocatoria = item.numeroConvocatoria
  const title = item.descripcion || item.descripcionLeng || `Convocatoria ${numeroConvocatoria}`
  const openingDate = detail?.fechaInicioSolicitud ?? null
  const deadline = detail?.fechaFinSolicitud ?? null

  const organismo = detail?.organo?.nivel3
    ?? item.nivel3
    ?? detail?.organo?.nivel2
    ?? item.nivel2
    ?? detail?.organo?.nivel1
    ?? item.nivel1
    ?? null

  const tags = [
    detail?.descripcionFinalidad?.toLowerCase() ?? null,
    detail?.mrr || item.mrr ? 'mrr' : null,
  ].filter((v): v is string => Boolean(v))

  const summary = detail?.descripcionFinalidad
    ? `${detail.descripcionFinalidad}${detail.tipoConvocatoria ? ` · ${detail.tipoConvocatoria}` : ''}`
    : null

  return {
    id: `infosubvenciones-${numeroConvocatoria}`,
    external_id: numeroConvocatoria,
    title,
    body: detail?.descripcionBasesReguladoras ?? null,
    organismo,
    source: 'bdns',
    source_url: buildSourceUrl(detail, numeroConvocatoria, vpd),
    publication_date: detail?.fechaRecepcion ?? item.fechaRecepcion ?? null,
    opening_date: openingDate,
    deadline,
    budget_total: detail?.presupuestoTotal ?? null,
    budget_per_company_min: null,
    budget_per_company_max: null,
    grant_type: inferGrantType(detail?.instrumentos ?? null),
    scope: normalizeScope(detail?.organo?.nivel1 ?? item.nivel1),
    regions: (detail?.regiones ?? []).map((r) => r.descripcion ?? '').filter(Boolean),
    sectors: (detail?.sectores ?? []).map((s) => s.descripcion ?? '').filter(Boolean),
    cnae_codes: (detail?.sectores ?? []).map((s) => s.codigo ?? '').filter(Boolean),
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
    status: inferStatus(detail?.abierto, openingDate, deadline),
    difficulty_score: 5,
    success_rate: null,
    summary,
    raw_text: null,
    created_at: now,
    updated_at: now,
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = (searchParams.get('q') ?? '').trim()
  const page = Math.max(0, Number.parseInt(searchParams.get('page') ?? '0', 10) || 0)
  const pageSize = Math.min(30, Math.max(1, Number.parseInt(searchParams.get('pageSize') ?? '20', 10) || 20))
  const vpd = (searchParams.get('vpd') ?? DEFAULT_VPD).trim() || 'GE'

  const listPath = query ? '/convocatorias/busqueda' : '/convocatorias/ultimas'
  const listParams = new URLSearchParams({
    vpd,
    page: String(page),
    pageSize: String(pageSize),
    order: 'fechaRecepcion',
    direccion: 'DESC',
  })

  if (query) {
    listParams.set('descripcion', query)
  }

  try {
    const listResponse = await fetchJson<ConvocatoriaListResponse>(`${BASE_URL}${listPath}?${listParams.toString()}`)
    const items = listResponse.content ?? []
    const detailByConvocatoria = new Map<string, ConvocatoriaDetail | null>()
    const itemsWithDetail = items.slice(0, 10)

    await Promise.all(
      itemsWithDetail.map(async (item) => {
        try {
          const detailUrl = `${BASE_URL}/convocatorias?${new URLSearchParams({
            numConv: item.numeroConvocatoria,
            vpd,
          }).toString()}`
          const detail = await fetchJson<ConvocatoriaDetail>(detailUrl, 8000)
          detailByConvocatoria.set(item.numeroConvocatoria, detail)
        } catch {
          detailByConvocatoria.set(item.numeroConvocatoria, null)
        }
      })
    )

    const grants = items.map((item) => mapToGrant(item, detailByConvocatoria.get(item.numeroConvocatoria) ?? null, vpd))

    return NextResponse.json({
      data: grants,
      pagination: {
        page,
        pageSize,
        totalElements: listResponse.totalElements ?? grants.length,
        totalPages: listResponse.totalPages ?? 1,
        last: listResponse.last ?? true,
      },
      warning: listResponse.advertencia ?? null,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown_error'
    return NextResponse.json(
      {
        data: [],
        error: 'No se pudo recuperar información de infosubvenciones.es',
        details: message,
      },
      { status: 502 }
    )
  }
}
