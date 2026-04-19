import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Header from '@/components/dashboard/header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import StatusPanel from '@/components/applications/status-panel'
import ApplicationGuideComponent from '@/components/applications/application-guide'
import type { ApplicationGuide } from '@/lib/application-guide'
import Link from 'next/link'
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  FileText,
  Receipt,
  ChevronRight,
  CalendarDays,
  AlertTriangle,
} from 'lucide-react'
import { formatCurrency, formatDate, statusLabel, daysUntil, urgencyLabel } from '@/lib/utils'

const TIMELINE_STEPS = [
  { status: 'draft', label: 'Borrador', icon: FileText },
  { status: 'submitted', label: 'Enviada', icon: CheckCircle2 },
  { status: 'approved', label: 'Resuelta', icon: CheckCircle2 },
  { status: 'pending_justification', label: 'Justificación', icon: Receipt },
  { status: 'justified', label: 'Cerrada', icon: CheckCircle2 },
]

const STATUS_ORDER = ['draft', 'review', 'submitted', 'subsanacion', 'approved', 'denied', 'pending_justification', 'justified', 'closed']

export default async function ExpedienteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const appResult = await supabase.from('applications').select('*').eq('id', id).single()
  if (!appResult.data) notFound()
  const application = appResult.data as any

  const [eventsResult, invoicesResult] = await Promise.all([
    supabase.from('application_events').select('*').eq('application_id', id).order('created_at'),
    supabase.from('invoices').select('*').eq('application_id', id).order('invoice_date'),
  ])

  const events = eventsResult.data
  const invoices = invoicesResult.data

  let grant: any = null
  if (application.grant_id) {
    const grantResult = await supabase.from('grants').select('*').eq('id', application.grant_id).single()
    grant = grantResult.data
  }

  const { label, color } = statusLabel(application.status)
  const justDays = daysUntil(application.justification_deadline)

  const meta = (application.metadata ?? {}) as Record<string, unknown>
  const guide = meta.guide_status === 'ready' ? (meta.guide as ApplicationGuide) : null
  const completedItems = (meta.completed_items ?? []) as string[]
  const { label: urgLabel, color: urgColor } = urgencyLabel(justDays)

  const currentStatusIdx = STATUS_ORDER.indexOf(application.status)
  const justifiedPct = application.approved_amount && application.justified_amount
    ? Math.min(100, (application.justified_amount / application.approved_amount) * 100)
    : 0

  const totalInvoices = (invoices || []).reduce((sum, inv) => sum + (inv.amount_total || 0), 0)
  const eligibleInvoices = (invoices || []).filter(inv => inv.is_eligible !== false)
  const totalEligible = eligibleInvoices.reduce((sum, inv) => sum + (inv.amount_total || 0), 0)

  return (
    <div className="flex flex-col h-full overflow-auto">
      <Header title="Expediente" subtitle={grant?.title || ''} />

      <div className="flex-1 p-6 max-w-5xl mx-auto w-full">
        <Link href="/dashboard/expedientes" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-5">
          <ArrowLeft className="w-4 h-4" />
          Volver a Expedientes
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-5">
            {/* Header card */}
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${color}`}>{label}</span>
                  {application.reference_number && (
                    <span className="text-xs font-mono text-gray-400">Ref: {application.reference_number}</span>
                  )}
                </div>
                <h2 className="text-lg font-bold text-gray-900">{grant?.title}</h2>
                <p className="text-sm text-gray-500">{grant?.organismo}</p>
                {application.company_id && (
                  <p className="text-xs text-gray-400 mt-1">ID: {application.company_id}</p>
                )}
              </CardContent>
            </Card>

            {/* Timeline */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-indigo-500" />
                  Timeline del expediente
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center gap-0">
                  {TIMELINE_STEPS.map((step, i) => {
                    const stepIdx = STATUS_ORDER.indexOf(step.status)
                    const isCompleted = currentStatusIdx > stepIdx
                    const isCurrent = currentStatusIdx === stepIdx || (step.status === 'approved' && ['approved', 'pending_justification', 'justified'].includes(application.status))
                    const Icon = step.icon

                    return (
                      <div key={step.status} className="flex items-center flex-1">
                        <div className="flex flex-col items-center">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors ${
                            isCompleted ? 'bg-indigo-600 border-indigo-600' :
                            isCurrent ? 'bg-white border-indigo-600' :
                            'bg-white border-gray-200'
                          }`}>
                            <Icon className={`w-3.5 h-3.5 ${isCompleted ? 'text-white' : isCurrent ? 'text-indigo-600' : 'text-gray-300'}`} />
                          </div>
                          <p className={`text-xs mt-1.5 font-medium text-center ${isCurrent ? 'text-indigo-700' : isCompleted ? 'text-gray-600' : 'text-gray-300'}`}>
                            {step.label}
                          </p>
                        </div>
                        {i < TIMELINE_STEPS.length - 1 && (
                          <div className={`flex-1 h-0.5 mx-1 mb-4 ${isCompleted ? 'bg-indigo-600' : 'bg-gray-200'}`} />
                        )}
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            {/* AI Guide */}
            {guide ? (
              <ApplicationGuideComponent
                applicationId={application.id}
                guide={guide}
                completedItems={completedItems}
              />
            ) : meta.guide_status === 'failed' ? (
              <Card className="border-amber-200 bg-amber-50">
                <CardContent className="p-4 flex items-center gap-3 text-sm text-amber-800">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                  No se pudo generar la guía de presentación automática. Comprueba que la clave de OpenAI está configurada.
                </CardContent>
              </Card>
            ) : null}

            {/* Events */}
            {(events || []).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Historial de actividad</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-3">
                    {events!.map((event) => (
                      <div key={event.id} className="flex gap-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">{event.title}</p>
                          {event.description && <p className="text-xs text-gray-500">{event.description}</p>}
                          <p className="text-xs text-gray-400 mt-0.5">{formatDate(event.created_at)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Invoices summary */}
            {(invoices || []).length > 0 && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Receipt className="w-4 h-4 text-purple-500" />
                      Facturas de justificación
                    </CardTitle>
                    <Link href={`/dashboard/justificacion?appId=${application.id}`}>
                      <Button size="sm" variant="outline" className="gap-1">
                        Gestionar <ChevronRight className="w-3.5 h-3.5" />
                      </Button>
                    </Link>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-2">
                    {invoices!.slice(0, 5).map((inv) => (
                      <div key={inv.id} className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
                        <div>
                          <p className="text-xs font-medium text-gray-800">{inv.supplier_name || 'Proveedor sin nombre'}</p>
                          <p className="text-xs text-gray-500">{inv.concept}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-gray-700">{formatCurrency(inv.amount_total || 0)}</span>
                          {inv.is_eligible === true && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                          {inv.is_eligible === false && <span className="text-xs text-red-500">No elegible</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between text-sm">
                    <span className="text-gray-500">Total elegible</span>
                    <span className="font-semibold text-emerald-700">{formatCurrency(totalEligible)}</span>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <Card>
              <CardContent className="p-4 space-y-4">
                {application.requested_amount && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Solicitado</p>
                    <p className="text-xl font-bold text-gray-900">{formatCurrency(application.requested_amount)}</p>
                  </div>
                )}
                {application.approved_amount && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Concedido</p>
                    <p className="text-xl font-bold text-emerald-700">{formatCurrency(application.approved_amount)}</p>
                  </div>
                )}
                {application.status === 'pending_justification' && application.approved_amount && (
                  <div>
                    <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                      <span>Justificado</span>
                      <span className="font-medium">{justifiedPct.toFixed(0)}%</span>
                    </div>
                    <div className="h-2.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${justifiedPct >= 100 ? 'bg-emerald-500' : 'bg-purple-500'}`}
                        style={{ width: `${justifiedPct}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {formatCurrency(application.justified_amount)} / {formatCurrency(application.approved_amount)}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 space-y-3">
                {application.submission_date && (
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-500">Enviada</p>
                    <p className="text-xs font-medium text-gray-700">{formatDate(application.submission_date)}</p>
                  </div>
                )}
                {application.resolution_date && (
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-500">Resolución</p>
                    <p className="text-xs font-medium text-gray-700">{formatDate(application.resolution_date)}</p>
                  </div>
                )}
                {application.justification_deadline && (
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-500">Justificación</p>
                    <p className={`text-xs font-medium ${urgColor}`}>{formatDate(application.justification_deadline)}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <StatusPanel
              applicationId={application.id}
              currentStatus={application.status}
              approvedAmount={application.approved_amount}
              referenceNumber={application.reference_number}
            />

            {application.status === 'pending_justification' && (
              <Link href={`/dashboard/justificacion?appId=${application.id}`} className="block">
                <Button className="w-full gap-2">
                  <Receipt className="w-4 h-4" />
                  Gestionar justificación
                </Button>
              </Link>
            )}

            {application.notes && (
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-gray-500 font-medium mb-1.5">Notas</p>
                  <p className="text-sm text-gray-700">{application.notes}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
