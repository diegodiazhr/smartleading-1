import React from 'react'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Header from '@/components/dashboard/header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import {
  ArrowLeft,
  Clock,
  Euro,
  Globe,
  Building,
  MapPin,
  CheckCircle2,
  XCircle,
  FileText,
  AlertTriangle,
  Sparkles,
  ExternalLink,
  Zap,
} from 'lucide-react'
import { formatCurrency, formatDate, daysUntil, urgencyLabel, grantTypeLabel, statusLabel } from '@/lib/utils'

export default async function GrantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: grantRaw } = await supabase
    .from('grants')
    .select('*')
    .eq('id', id)
    .single()

  if (!grantRaw) notFound()
  const grant = grantRaw as any

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
            {requirements.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    Requisitos de elegibilidad
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <ul className="space-y-2">
                    {requirements.map((req, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm text-gray-700">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                        {req.req}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Eligible expenses */}
            {eligibleExpenses.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Euro className="w-4 h-4 text-blue-500" />
                    Gastos elegibles
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <ul className="space-y-2">
                    {eligibleExpenses.map((exp, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm text-gray-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-2 shrink-0" />
                        {exp.expense}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Required docs */}
            {requiredDocs.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <FileText className="w-4 h-4 text-amber-500" />
                    Documentación necesaria
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
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
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Key stats */}
            <Card className="bg-gradient-to-b from-indigo-50 to-white">
              <CardContent className="p-5 space-y-4">
                {/* Amount */}
                {grant.budget_per_company_max && (
                  <div>
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Importe máximo</p>
                    <p className="text-2xl font-bold text-emerald-700">{formatCurrency(grant.budget_per_company_max)}</p>
                    {grant.budget_per_company_min && grant.budget_per_company_min !== grant.budget_per_company_max && (
                      <p className="text-xs text-gray-500">Mínimo: {formatCurrency(grant.budget_per_company_min)}</p>
                    )}
                  </div>
                )}

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
                <Link href={`/dashboard/expedientes/nuevo?grantId=${grant.id}`} className="block">
                  <Button className="w-full gap-2">
                    <Zap className="w-4 h-4" />
                    Iniciar solicitud con IA
                  </Button>
                </Link>
                {grant.source_url && (
                  <a href={grant.source_url} target="_blank" rel="noopener noreferrer" className="block">
                    <Button variant="outline" className="w-full gap-2">
                      <ExternalLink className="w-4 h-4" />
                      Ver convocatoria oficial
                    </Button>
                  </a>
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
            {(grant.min_employees !== null || grant.max_employees !== null) && (
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-2">Tamaño empresa</p>
                  <p className="text-sm text-gray-800">
                    {grant.min_employees !== null && grant.max_employees !== null
                      ? `${grant.min_employees} – ${grant.max_employees} empleados`
                      : grant.max_employees !== null
                        ? `Hasta ${grant.max_employees} empleados`
                        : `Mínimo ${grant.min_employees} empleados`}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
