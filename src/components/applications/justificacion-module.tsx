'use client'

import { useState, useCallback } from 'react'
import type { Application, Invoice } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import {
  Upload,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Receipt,
  Sparkles,
  Clock,
  FileText,
  Euro,
  Inbox,
} from 'lucide-react'
import { formatCurrency, formatDate, daysUntil, urgencyLabel, cn } from '@/lib/utils'

interface Props {
  applications: Array<Application & { grant?: { id: string; title: string; organismo: string | null } | null }>
  selectedAppId: string | null
  initialInvoices: Invoice[]
}

export default function JustificacionModule({ applications, selectedAppId, initialInvoices }: Props) {
  const [activeAppId, setActiveAppId] = useState(selectedAppId)
  const [invoices] = useState<Invoice[]>(initialInvoices)
  const [dragging, setDragging] = useState(false)

  const activeApp = applications.find(a => a.id === activeAppId)
  const grant = activeApp?.grant as any

  const appInvoices = invoices.filter(inv => inv.application_id === activeAppId)
  const totalInvoiced = appInvoices.reduce((sum, inv) => sum + (inv.amount_total || 0), 0)
  const totalEligible = appInvoices.filter(inv => inv.is_eligible !== false).reduce((sum, inv) => sum + (inv.amount_total || 0), 0)
  const totalRejected = appInvoices.filter(inv => inv.is_eligible === false).reduce((sum, inv) => sum + (inv.amount_total || 0), 0)

  const justifiedPct = activeApp?.approved_amount
    ? Math.min(100, (totalEligible / activeApp.approved_amount) * 100)
    : 0

  const remaining = activeApp?.approved_amount ? Math.max(0, activeApp.approved_amount - totalEligible) : 0

  const justDays = daysUntil(activeApp?.justification_deadline)
  const { label: urgLabel, color: urgColor } = urgencyLabel(justDays)

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const files = Array.from(e.dataTransfer.files)
    alert(`${files.length} archivo(s) recibidos. En la versión completa se procesarían con OCR y IA. Archivos: ${files.map(f => f.name).join(', ')}`)
  }, [])

  if (applications.length === 0) {
    return (
      <div className="text-center py-20">
        <Receipt className="w-14 h-14 mx-auto mb-4 text-gray-200" />
        <h3 className="font-semibold text-gray-700 mb-2">Sin expedientes para justificar</h3>
        <p className="text-sm text-gray-400 mb-6">
          Los expedientes aprobados aparecerán aquí para gestionar su justificación.
        </p>
        <Link href="/dashboard/expedientes">
          <Button variant="outline">Ver todos los expedientes</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      {/* Sidebar: application selector */}
      <div className="lg:col-span-1">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Expedientes a justificar</h3>
        <div className="space-y-2">
          {applications.map(app => {
            const g = app.grant as any
            const days = daysUntil(app.justification_deadline)
            const { color } = urgencyLabel(days)
            const pct = app.approved_amount ? Math.min(100, (app.justified_amount / app.approved_amount) * 100) : 0

            return (
              <button
                key={app.id}
                onClick={() => setActiveAppId(app.id)}
                className={cn(
                  'w-full text-left p-3 rounded-xl border transition-all',
                  activeAppId === app.id
                    ? 'border-indigo-200 bg-indigo-50 shadow-sm'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                )}
              >
                <p className="text-xs font-semibold text-gray-900 line-clamp-2">{g?.title}</p>
                {app.approved_amount && (
                  <p className="text-xs text-emerald-700 font-medium mt-0.5">
                    {formatCurrency(app.approved_amount)} concedidos
                  </p>
                )}
                <div className="mt-2">
                  <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={cn('h-full rounded-full', pct >= 100 ? 'bg-emerald-500' : 'bg-purple-500')}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className={`text-xs mt-1 ${color}`}>{urgLabel}</p>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Main content */}
      <div className="lg:col-span-3 space-y-5">
        {activeApp ? (
          <>
            {/* Header */}
            <Card>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="font-bold text-gray-900">{grant?.title}</h2>
                    <p className="text-sm text-gray-500">{grant?.organismo}</p>
                    {activeApp.justification_deadline && (
                      <div className={`flex items-center gap-1.5 mt-1.5 text-sm ${urgColor}`}>
                        <Clock className="w-4 h-4" />
                        <span>Justificación hasta: {formatDate(activeApp.justification_deadline)} ({urgLabel})</span>
                      </div>
                    )}
                  </div>
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <Sparkles className="w-4 h-4 text-indigo-500" />
                    Generar memoria IA
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {activeApp.approved_amount && (
                <Card>
                  <CardContent className="pt-4 pb-4">
                    <p className="text-xs text-gray-400 uppercase tracking-wide">Concedido</p>
                    <p className="text-lg font-bold text-emerald-700">{formatCurrency(activeApp.approved_amount)}</p>
                  </CardContent>
                </Card>
              )}
              <Card>
                <CardContent className="pt-4 pb-4">
                  <p className="text-xs text-gray-400 uppercase tracking-wide">Facturas subidas</p>
                  <p className="text-lg font-bold text-gray-900">{formatCurrency(totalInvoiced)}</p>
                  <p className="text-xs text-gray-400">{appInvoices.length} facturas</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-4">
                  <p className="text-xs text-gray-400 uppercase tracking-wide">Elegible</p>
                  <p className="text-lg font-bold text-indigo-700">{formatCurrency(totalEligible)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4 pb-4">
                  <p className="text-xs text-gray-400 uppercase tracking-wide">Pendiente</p>
                  <p className={cn('text-lg font-bold', remaining > 0 ? 'text-amber-600' : 'text-emerald-600')}>
                    {remaining > 0 ? formatCurrency(remaining) : '¡Completado!'}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Progress */}
            {activeApp.approved_amount && (
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-gray-700">Progreso de justificación</p>
                    <p className="text-sm font-bold text-indigo-700">{justifiedPct.toFixed(0)}%</p>
                  </div>
                  <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all', justifiedPct >= 100 ? 'bg-emerald-500' : 'bg-purple-500')}
                      style={{ width: `${justifiedPct}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-1.5 text-xs text-gray-500">
                    <span>{formatCurrency(totalEligible)} justificados</span>
                    <span>{formatCurrency(activeApp.approved_amount)} objetivo</span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Upload zone */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Upload className="w-4 h-4 text-indigo-500" />
                  Subir facturas
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={onDrop}
                  className={cn(
                    'border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer',
                    dragging ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 hover:border-gray-300 bg-gray-50'
                  )}
                  onClick={() => document.getElementById('file-upload')?.click()}
                >
                  <input id="file-upload" type="file" multiple accept=".pdf,.jpg,.jpeg,.png" className="hidden" />
                  <Inbox className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                  <p className="text-sm font-medium text-gray-700">Arrastra facturas aquí</p>
                  <p className="text-xs text-gray-400 mt-1">o haz clic para seleccionar archivos · PDF, JPG, PNG</p>
                  <div className="flex items-center justify-center gap-3 mt-4">
                    <span className="text-xs text-gray-400">O envía por:</span>
                    <Button size="sm" variant="outline" className="text-xs h-7">📧 Email</Button>
                    <Button size="sm" variant="outline" className="text-xs h-7">💬 Telegram</Button>
                    <Button size="sm" variant="outline" className="text-xs h-7">📱 WhatsApp</Button>
                  </div>
                </div>

                <div className="mt-3 bg-indigo-50 rounded-lg p-3 flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-indigo-800">
                    La IA extraerá automáticamente datos de cada factura (OCR), validará si el gasto es elegible según la convocatoria y te alertará de cualquier problema.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Invoice list */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Facturas ({appInvoices.length})
                  </CardTitle>
                  {totalRejected > 0 && (
                    <div className="flex items-center gap-1.5 text-xs text-amber-600">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {formatCurrency(totalRejected)} no elegibles
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {appInvoices.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <Receipt className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Aún no hay facturas subidas</p>
                    <p className="text-xs mt-1">Sube tu primera factura usando la zona de arriba</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {appInvoices.map((inv) => (
                      <div key={inv.id} className={cn(
                        'flex items-center gap-3 p-3 rounded-lg border',
                        inv.is_eligible === true ? 'border-emerald-100 bg-emerald-50' :
                        inv.is_eligible === false ? 'border-red-100 bg-red-50' :
                        'border-gray-100 bg-white'
                      )}>
                        <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center shrink-0">
                          <Receipt className="w-4 h-4 text-gray-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {inv.supplier_name || 'Proveedor'}
                            </p>
                            {inv.invoice_number && (
                              <span className="text-xs text-gray-400 font-mono">{inv.invoice_number}</span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 truncate">{inv.concept}</p>
                          {inv.rejection_reason && (
                            <p className="text-xs text-red-600 mt-0.5">⚠️ {inv.rejection_reason}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <p className="text-sm font-semibold text-gray-900">{formatCurrency(inv.amount_total || 0)}</p>
                            <p className="text-xs text-gray-400">{formatDate(inv.invoice_date)}</p>
                          </div>
                          {inv.is_eligible === true && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                          {inv.is_eligible === false && <XCircle className="w-4 h-4 text-red-500" />}
                          {inv.is_eligible === null && <div className="w-4 h-4 border-2 border-gray-300 rounded-full animate-pulse" />}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        ) : (
          <div className="text-center py-16">
            <Receipt className="w-12 h-12 mx-auto mb-3 text-gray-200" />
            <p className="text-gray-500">Selecciona un expediente para gestionar su justificación</p>
          </div>
        )}
      </div>
    </div>
  )
}
