import React from 'react'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Header from '@/components/dashboard/header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Grant } from '@/lib/types'
import Link from 'next/link'
import {
  ArrowLeft,
  Clock,
  Euro,
  Globe,
  Building,
  MapPin,
  CheckCircle2,
  FileText,
  AlertTriangle,
  Sparkles,
  ExternalLink,
  Zap,
} from 'lucide-react'
import { formatCurrency, formatDate, daysUntil, urgencyLabel, grantTypeLabel, statusLabel } from '@/lib/utils'

const INFOSUBVENCIONES_VPD = process.env.INFOSUBVENCIONES_VPD ?? 'GE'
const INFOSUBVENCIONES_API_BASE_URL = (process.env.INFOSUBVENCIONES_API_BASE_URL ?? 'https://www.infosubvenciones.es/bdnstrans/api').replace(/\/+$/, '')

interface InfosubvencionesDetail {
  codigoBDNS: string
  descripcion: string | null
  descripcionLeng: string | null
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
  tiposBeneficiarios?: Array<{ descripcion: string | null }> | null
  documentos?: Array<{ descripcion: string | null; nombreFic: string | null }> | null
  objetivos?: Array<{ descripcion: string | null }> | null
}

function inferGrantType(text: string): Grant['grant_type'] {
  if (text.includes('préstamo') || text.includes('prestamo')) return 'prestamo'
  if (text.includes('bonific')) return 'bonificacion'
  if (text.includes('aval')) return 'aval'
  return 'fondo_perdido'
}

function inferScope(level: string | null | undefined): Grant['scope'] {
  const value = (level ?? '').toUpperCase()
  if (value.includes('ESTATAL') || value.includes('NACIONAL')) return 'nacional'
  if (value.includes('AUTONOM')) return 'autonomico'
  if (value.includes('EUROPE')) return 'europeo'
  return 'municipal'
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

function ensureAbsoluteUrl(url: string): string {
  if (!url) return url
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  return `https://${url}`
}

function buildSourceUrl(detail: InfosubvencionesDetail, numConv: string): string {
  if (detail.urlBasesReguladoras) return ensureAbsoluteUrl(detail.urlBasesReguladoras)
  if (detail.sedeElectronica) return ensureAbsoluteUrl(detail.sedeElectronica)
  return `https://www.infosubvenciones.es/bdnstrans/${encodeURIComponent(INFOSUBVENCIONES_VPD)}/es/convocatoria/${encodeURIComponent(numConv)}`
}

async function fetchInfosubvencionesGrant(numConv: string): Promise<Grant | null> {
  const url = `${INFOSUBVENCIONES_API_BASE_URL}/convocatorias?${new URLSearchParams({
    numConv,
    vpd: INFOSUBVENCIONES_VPD,
  }).toString()}`

  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  })

  if (!response.ok) return null
  const detail = await response.json() as InfosubvencionesDetail

  const now = new Date().toISOString()
  const openingDate = detail.fechaInicioSolicitud ?? null
  const deadline = detail.fechaFinSolicitud ?? null
  const instrumentText = (detail.instrumentos ?? []).map((i) => (i.descripcion ?? '').toLowerCase()).join(' ')

  return {
    id: `infosubvenciones-${numConv}`,
    external_id: numConv,
    title: detail.descripcion || detail.descripcionLeng || `Convocatoria ${numConv}`,
    body: detail.descripcionBasesReguladoras ?? null,
    organismo: detail.organo?.nivel3 ?? detail.organo?.nivel2 ?? detail.organo?.nivel1 ?? null,
    source: 'bdns',
    source_url: buildSourceUrl(detail, numConv),
    publication_date: detail.fechaRecepcion ?? null,
    opening_date: openingDate,
    deadline,
    budget_total: detail.presupuestoTotal ?? null,
    budget_per_company_min: null,
    budget_per_company_max: null,
    grant_type: inferGrantType(instrumentText),
    scope: inferScope(detail.organo?.nivel1),
    regions: (detail.regiones ?? []).map((r) => r.descripcion ?? '').filter(Boolean),
    sectors: (detail.sectores ?? []).map((s) => s.descripcion ?? '').filter(Boolean),
    cnae_codes: (detail.sectores ?? []).map((s) => s.codigo ?? '').filter(Boolean),
    min_employees: null,
    max_employees: null,
    min_revenue: null,
    max_revenue: null,
    min_company_age_years: null,
    requirements: (detail.tiposBeneficiarios ?? [])
      .map((b) => b.descripcion ?? '')
      .filter(Boolean)
      .map((req) => ({ req })),
    eligible_expenses: (detail.objetivos ?? [])
      .map((o) => o.descripcion ?? '')
      .filter(Boolean)
      .map((expense) => ({ expense })),
    required_documents: (detail.documentos ?? [])
      .map((d) => d.descripcion || d.nombreFic || '')
      .filter(Boolean)
      .map((doc) => ({ doc })),
    keywords: [],
    tags: [
      detail.descripcionFinalidad?.toLowerCase() ?? null,
      detail.mrr ? 'mrr' : null,
    ].filter((v): v is string => Boolean(v)),
    status: inferStatus(detail.abierto, openingDate, deadline),
    difficulty_score: 5,
    success_rate: null,
    summary: detail.descripcionFinalidad
      ? `${detail.descripcionFinalidad}${detail.tipoConvocatoria ? ` · ${detail.tipoConvocatoria}` : ''}`
      : null,
    raw_text: null,
    created_at: now,
    updated_at: now,
  }
}

export default async function GrantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  let grant: Grant | null = null

  if (id.startsWith('infosubvenciones-')) {
    const externalId = id.replace('infosubvenciones-', '')
    if (!externalId) notFound()
    grant = await fetchInfosubvencionesGrant(externalId)
  } else {
    const supabase = await createClient()
    const { data: grantRaw } = await supabase
      .from('grants')
      .select('*')
      .eq('id', id)
      .single()
    grant = grantRaw as Grant | null
  }

  if (!grant) notFound()

  const isExternalGrant = id.startsWith('infosubvenciones-')

  const days = daysUntil(grant.deadline)
  const { label: urgLabel, color: urgColor } = urgencyLabel(days)
  const { label: statusLbl, color: statusColor } = statusLabel(grant.status)

  const requirements = Array.isArray(grant.requirements) ? grant.requirements as Array<{req: string}> : []
  const eligibleExpenses = Array.isArray(grant.eligible_expenses) ? grant.eligible_expenses as Array<{expense: string}> : []
  const requiredDocs = Array.isArray(grant.required_documents) ? grant.required_documents as Array<{doc: string}> : []

  const scopeIconMap: Record<string, React.ElementType> = { europeo: Globe, nacional: Building, autonomico: MapPin, municipal: MapPin }
  const scopeIcon = scopeIconMap[grant.scope as string] || Building
  const ScopeIcon = scopeIcon

  const difficultyLabel = grant.difficulty_score <= 3
    ? { text: 'Fácil', color: 'bg-emerald-100 text-emerald-700', bar: 'bg-emerald-500' }
    : grant.difficulty_score <= 6
      ? { text: 'Media', color: 'bg-amber-100 text-amber-700', bar: 'bg-amber-500' }
      : { text: 'Alta', color: 'bg-red-100 text-red-700', bar: 'bg-red-500' }

  return (
    <div className="flex flex-col h-full overflow-auto">
      <Header title={grant.title} subtitle={grant.organismo || ''} />

      <div className="flex-1 p-6 max-w-6xl mx-auto w-full">
        {/* Breadcrumb */}
        <Link href="/dashboard/subvenciones" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-5">
          <ArrowLeft className="w-4 h-4" />
          Volver a Subvenciones
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-5">
            {/* Hero */}
            <Card>
              <CardContent className="p-5">
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColor}`}>
                    {statusLbl}
                  </span>
                  <Badge variant="secondary" className="gap-1">
                    <ScopeIcon className="w-3 h-3" />
                    {grant.scope}
                  </Badge>
                  <Badge variant={grant.grant_type === 'fondo_perdido' ? 'success' : grant.grant_type === 'prestamo' ? 'blue' : 'warning'}>
                    {grantTypeLabel(grant.grant_type)}
                  </Badge>
                  {(grant.tags as string[] | null)?.map((tag: string) => (
                    <span key={tag} className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">#{tag}</span>
                  ))}
                </div>

                <h1 className="text-xl font-bold text-gray-900 mb-1">{grant.title}</h1>
                <p className="text-sm text-gray-600 mb-4">{grant.organismo}</p>

                {grant.summary && (
                  <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="w-4 h-4 text-indigo-600" />
                      <span className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">Resumen IA</span>
                    </div>
                    <p className="text-sm text-indigo-900">{grant.summary}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Requirements */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  Requisitos de elegibilidad
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {requirements.length > 0 ? (
                  <ul className="space-y-2">
                    {requirements.map((req, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm text-gray-700">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                        {req.req}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-500">No se han publicado requisitos específicos en el origen.</p>
                )}
              </CardContent>
            </Card>

            {/* Eligible expenses */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Euro className="w-4 h-4 text-blue-500" />
                  Gastos elegibles
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {eligibleExpenses.length > 0 ? (
                  <ul className="space-y-2">
                    {eligibleExpenses.map((exp, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm text-gray-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-2 shrink-0" />
                        {exp.expense}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-500">No se han detallado gastos elegibles en la fuente.</p>
                )}
              </CardContent>
            </Card>

            {/* Required docs */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileText className="w-4 h-4 text-amber-500" />
                  Documentación necesaria
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {requiredDocs.length > 0 ? (
                  <ul className="space-y-2">
                    {requiredDocs.map((doc, i) => (
                      <li key={i} className="flex items-center gap-2.5 text-sm text-gray-700">
                        <div className="w-4 h-4 border-2 border-gray-300 rounded flex items-center justify-center shrink-0">
                          <div className="w-2 h-2 rounded-sm bg-gray-300" />
                        </div>
                        {doc.doc}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-500">No se ha publicado documentación asociada.</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Key stats */}
            <Card className="bg-gradient-to-b from-indigo-50 to-white">
              <CardContent className="p-5 space-y-4">
                {/* Amount */}
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Importe máximo</p>
                  {grant.budget_per_company_max ? (
                    <>
                      <p className="text-2xl font-bold text-emerald-700">{formatCurrency(grant.budget_per_company_max)}</p>
                      {grant.budget_per_company_min && grant.budget_per_company_min !== grant.budget_per_company_max && (
                        <p className="text-xs text-gray-500">Mínimo: {formatCurrency(grant.budget_per_company_min)}</p>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-gray-500">No especificado en la convocatoria</p>
                  )}
                </div>

                {/* Deadline */}
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Plazo</p>
                  <div className={`flex items-center gap-2 ${urgColor}`}>
                    <Clock className="w-4 h-4" />
                    <span className="font-semibold">{urgLabel} restantes</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">Cierra: {formatDate(grant.deadline)}</p>
                  {grant.opening_date && (
                    <p className="text-xs text-gray-500">Apertura: {formatDate(grant.opening_date)}</p>
                  )}
                </div>

                {/* Difficulty */}
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1.5">Dificultad</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${difficultyLabel.bar}`}
                        style={{ width: `${(grant.difficulty_score / 10) * 100}%` }}
                      />
                    </div>
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${difficultyLabel.color}`}>
                      {difficultyLabel.text}
                    </span>
                  </div>
                </div>

                {/* Success rate */}
                {grant.success_rate && (
                  <div>
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1.5">Tasa de aprobación histórica</p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-indigo-500" style={{ width: `${grant.success_rate}%` }} />
                      </div>
                      <span className="text-sm font-semibold text-indigo-700">{grant.success_rate.toFixed(0)}%</span>
                    </div>
                  </div>
                )}

                {/* Budget total */}
                {grant.budget_total && (
                  <div>
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Presupuesto total convocatoria</p>
                    <p className="text-sm font-semibold text-gray-700">{formatCurrency(grant.budget_total)}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* CTA */}
            <Card>
              <CardContent className="p-4 space-y-3">
                {!isExternalGrant ? (
                  <Link href={`/dashboard/expedientes/nuevo?grantId=${grant.id}`} className="block">
                    <Button className="w-full gap-2">
                      <Zap className="w-4 h-4" />
                      Iniciar solicitud con IA
                    </Button>
                  </Link>
                ) : (
                  <Button variant="outline" className="w-full gap-2" disabled>
                    <Zap className="w-4 h-4" />
                    Iniciar solicitud con IA
                  </Button>
                )}
                {grant.source_url && (
                  <a href={grant.source_url} target="_blank" rel="noopener noreferrer" className="block">
                    <Button variant="outline" className="w-full gap-2">
                      <ExternalLink className="w-4 h-4" />
                      Ver convocatoria oficial
                    </Button>
                  </a>
                )}
                {isExternalGrant && (
                  <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                    <p className="text-xs text-blue-800">
                      Convocatoria externa cargada desde infosubvenciones.es. Puedes revisar aquí el detalle y contrastarlo en la fuente oficial.
                    </p>
                  </div>
                )}
                <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 mt-0.5 shrink-0" />
                    <p className="text-xs text-amber-800">
                      Verifica siempre los requisitos en la convocatoria oficial antes de presentar la solicitud.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Size eligibility */}
            <Card>
              <CardContent className="p-4">
                <p className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-2">Tamaño empresa</p>
                <p className="text-sm text-gray-800">
                  {grant.min_employees !== null && grant.max_employees !== null
                    ? `${grant.min_employees} – ${grant.max_employees} empleados`
                    : grant.max_employees !== null
                      ? `Hasta ${grant.max_employees} empleados`
                      : grant.min_employees !== null
                        ? `Mínimo ${grant.min_employees} empleados`
                        : 'No especificado en la convocatoria'}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
