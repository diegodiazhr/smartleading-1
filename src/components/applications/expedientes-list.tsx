'use client'

import { useState } from 'react'
import type { Application } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import Link from 'next/link'
import {
  Plus,
  FolderOpen,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronRight,
  Receipt,
  FileText,
} from 'lucide-react'
import { formatCurrency, formatDate, daysUntil, urgencyLabel, statusLabel, cn } from '@/lib/utils'

interface Props {
  applications: Array<Application & { grant?: { id: string; title: string; organismo: string | null; deadline: string | null; budget_per_company_max: number | null; grant_type: string } | null }>
}

const STATUS_TABS = [
  { value: '', label: 'Todos', icon: FolderOpen },
  { value: 'draft', label: 'Borrador', icon: FileText },
  { value: 'submitted', label: 'Enviada', icon: CheckCircle2 },
  { value: 'subsanacion', label: 'Subsanación', icon: AlertTriangle },
  { value: 'approved', label: 'Aprobada', icon: CheckCircle2 },
  { value: 'pending_justification', label: 'Justificación', icon: Receipt },
  { value: 'denied', label: 'Denegada', icon: XCircle },
]

const STATUS_ICONS: Record<string, React.ElementType> = {
  draft: FileText,
  review: FileText,
  submitted: CheckCircle2,
  subsanacion: AlertTriangle,
  approved: CheckCircle2,
  denied: XCircle,
  pending_justification: Receipt,
  justified: Receipt,
  closed: FolderOpen,
}

export default function ExpedientesList({ applications }: Props) {
  const [activeTab, setActiveTab] = useState('')

  const filtered = activeTab ? applications.filter(a => a.status === activeTab) : applications

  const counts: Record<string, number> = {}
  applications.forEach(a => {
    counts[a.status] = (counts[a.status] || 0) + 1
  })

  return (
    <div className="space-y-5">
      {/* Header action */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">
            <span className="font-semibold text-gray-900">{applications.length}</span> expedientes en total
          </p>
        </div>
        <Link href="/dashboard/subvenciones">
          <Button className="gap-2">
            <Plus className="w-4 h-4" />
            Nueva solicitud
          </Button>
        </Link>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 flex-wrap border-b border-gray-200 pb-0">
        {STATUS_TABS.map(tab => {
          const count = tab.value ? counts[tab.value] || 0 : applications.length
          return (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={cn(
                'px-3 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 -mb-px',
                activeTab === tab.value
                  ? 'border-indigo-600 text-indigo-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              )}
            >
              {tab.label}
              {count > 0 && (
                <span className={cn(
                  'text-xs rounded-full px-1.5 min-w-[1.25rem] text-center',
                  activeTab === tab.value ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500'
                )}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Applications */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <FolderOpen className="w-12 h-12 mx-auto mb-3 text-gray-200" />
          <p className="font-medium text-gray-700">Sin expedientes</p>
          <p className="text-sm text-gray-400 mt-1 mb-4">
            {activeTab ? 'No hay expedientes en este estado' : 'Aún no has iniciado ninguna solicitud'}
          </p>
          <Link href="/dashboard/subvenciones">
            <Button variant="outline">Explorar subvenciones</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(app => <ExpedienteCard key={app.id} application={app} />)}
        </div>
      )}
    </div>
  )
}

function ExpedienteCard({ application }: { application: Props['applications'][number] }) {
  const { label, color } = statusLabel(application.status)
  const grant = application.grant
  const days = daysUntil(application.justification_deadline || grant?.deadline)
  const { label: urgLabel, color: urgColor } = urgencyLabel(days)

  const StatusIcon = STATUS_ICONS[application.status] || FolderOpen

  const justifiedPct = application.approved_amount && application.justified_amount
    ? Math.min(100, (application.justified_amount / application.approved_amount) * 100)
    : 0

  const isJustificationPending = application.status === 'pending_justification'

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div className={cn(
            'w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
            application.status === 'approved' || application.status === 'justified' ? 'bg-emerald-100' :
            application.status === 'denied' ? 'bg-red-100' :
            application.status === 'subsanacion' ? 'bg-amber-100' :
            application.status === 'pending_justification' ? 'bg-purple-100' :
            'bg-gray-100'
          )}>
            <StatusIcon className={cn(
              'w-4 h-4',
              application.status === 'approved' || application.status === 'justified' ? 'text-emerald-600' :
              application.status === 'denied' ? 'text-red-600' :
              application.status === 'subsanacion' ? 'text-amber-600' :
              application.status === 'pending_justification' ? 'text-purple-600' :
              'text-gray-500'
            )} />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${color}`}>{label}</span>
              {application.reference_number && (
                <span className="text-xs text-gray-400 font-mono">{application.reference_number}</span>
              )}
            </div>

            <h3 className="font-semibold text-gray-900 text-sm">
              {grant?.title || 'Subvención sin título'}
            </h3>
            <p className="text-xs text-gray-500">{grant?.organismo}</p>

            {/* Financial info */}
            <div className="flex items-center gap-4 mt-2 flex-wrap">
              {application.requested_amount && (
                <div>
                  <p className="text-xs text-gray-400">Solicitado</p>
                  <p className="text-sm font-semibold text-gray-700">{formatCurrency(application.requested_amount)}</p>
                </div>
              )}
              {application.approved_amount && (
                <div>
                  <p className="text-xs text-gray-400">Concedido</p>
                  <p className="text-sm font-semibold text-emerald-700">{formatCurrency(application.approved_amount)}</p>
                </div>
              )}
              {application.submission_date && (
                <div>
                  <p className="text-xs text-gray-400">Enviado</p>
                  <p className="text-xs text-gray-600">{formatDate(application.submission_date)}</p>
                </div>
              )}
            </div>

            {/* Justification progress */}
            {isJustificationPending && application.approved_amount && (
              <div className="mt-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs text-gray-500">Justificado</p>
                  <p className="text-xs font-medium text-purple-700">
                    {formatCurrency(application.justified_amount)} / {formatCurrency(application.approved_amount)}
                  </p>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={cn('h-full rounded-full', justifiedPct >= 100 ? 'bg-emerald-500' : 'bg-purple-500')}
                    style={{ width: `${justifiedPct}%` }}
                  />
                </div>
              </div>
            )}

            {/* Deadline warning */}
            {application.justification_deadline && isJustificationPending && (
              <div className={cn('flex items-center gap-1.5 mt-2 text-xs', urgColor)}>
                <Clock className="w-3.5 h-3.5" />
                <span>Justificación: {urgLabel} ({formatDate(application.justification_deadline)})</span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2 shrink-0">
            <Link href={`/dashboard/expedientes/${application.id}`}>
              <Button size="sm" variant="outline" className="gap-1 w-full">
                Ver <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
            {isJustificationPending && (
              <Link href={`/dashboard/justificacion?appId=${application.id}`}>
                <Button size="sm" className="gap-1 w-full">
                  <Receipt className="w-3.5 h-3.5" />
                  Justificar
                </Button>
              </Link>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
