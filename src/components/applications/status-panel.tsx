'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle2, AlertTriangle, XCircle, Send, Receipt, ChevronRight } from 'lucide-react'

const TRANSITIONS: Record<string, { label: string; next: string; icon: React.ElementType; color: string }[]> = {
  draft: [
    { label: 'Marcar en revisión', next: 'review', icon: ChevronRight, color: 'bg-blue-600 hover:bg-blue-700' },
    { label: 'Marcar como enviada', next: 'submitted', icon: Send, color: 'bg-indigo-600 hover:bg-indigo-700' },
  ],
  review: [
    { label: 'Marcar como enviada', next: 'submitted', icon: Send, color: 'bg-indigo-600 hover:bg-indigo-700' },
  ],
  submitted: [
    { label: 'Aprobada ✓', next: 'approved', icon: CheckCircle2, color: 'bg-emerald-600 hover:bg-emerald-700' },
    { label: 'Subsanación', next: 'subsanacion', icon: AlertTriangle, color: 'bg-amber-600 hover:bg-amber-700' },
    { label: 'Denegada ✗', next: 'denied', icon: XCircle, color: 'bg-red-600 hover:bg-red-700' },
  ],
  subsanacion: [
    { label: 'Subsanación enviada', next: 'submitted', icon: Send, color: 'bg-indigo-600 hover:bg-indigo-700' },
    { label: 'Denegada ✗', next: 'denied', icon: XCircle, color: 'bg-red-600 hover:bg-red-700' },
  ],
  approved: [
    { label: 'Iniciar justificación', next: 'pending_justification', icon: Receipt, color: 'bg-purple-600 hover:bg-purple-700' },
  ],
  pending_justification: [
    { label: 'Justificación enviada', next: 'justified', icon: CheckCircle2, color: 'bg-teal-600 hover:bg-teal-700' },
  ],
  justified: [
    { label: 'Cerrar expediente', next: 'closed', icon: CheckCircle2, color: 'bg-gray-600 hover:bg-gray-700' },
  ],
}

interface Props {
  applicationId: string
  currentStatus: string
  approvedAmount: number | null
  referenceNumber: string | null
}

export default function StatusPanel({ applicationId, currentStatus, approvedAmount, referenceNumber }: Props) {
  const router = useRouter()
  const transitions = TRANSITIONS[currentStatus] ?? []
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showApprovedForm, setShowApprovedForm] = useState(false)
  const [approvedInput, setApprovedInput] = useState(approvedAmount?.toString() ?? '')
  const [refInput, setRefInput] = useState(referenceNumber ?? '')
  const [justDeadlineInput, setJustDeadlineInput] = useState('')

  async function changeStatus(next: string) {
    // For approved status, show extra fields first
    if (next === 'approved' && !showApprovedForm) {
      setShowApprovedForm(true)
      return
    }

    setLoading(next)
    setError(null)

    const body: Record<string, unknown> = { status: next }
    if (next === 'approved') {
      if (approvedInput) body.approved_amount = Number(approvedInput)
      if (refInput) body.reference_number = refInput
    }
    if (next === 'pending_justification' && justDeadlineInput) {
      body.justification_deadline = justDeadlineInput
    }

    try {
      const res = await fetch(`/api/applications/${applicationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json() as { error?: string }
      if (!res.ok) { setError(data.error ?? 'Error'); return }
      router.refresh()
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(null)
      setShowApprovedForm(false)
    }
  }

  if (transitions.length === 0) return null

  return (
    <Card className="border-indigo-100">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Cambiar estado</CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {showApprovedForm && (
          <div className="space-y-2 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
            <p className="text-xs font-semibold text-emerald-800">Datos de resolución</p>
            <div>
              <label className="text-xs text-gray-600 block mb-1">Importe concedido (€)</label>
              <Input
                type="number"
                value={approvedInput}
                onChange={e => setApprovedInput(e.target.value)}
                placeholder="0"
              />
            </div>
            <div>
              <label className="text-xs text-gray-600 block mb-1">Nº de expediente / referencia</label>
              <Input
                value={refInput}
                onChange={e => setRefInput(e.target.value)}
                placeholder="SUBV-2026-XXXX"
              />
            </div>
          </div>
        )}

        {transitions.map(t => {
          const Icon = t.icon
          const isApprovedPending = t.next === 'approved' && showApprovedForm
          return (
            <Button
              key={t.next}
              size="sm"
              className={`w-full gap-2 text-white ${t.color}`}
              disabled={!!loading}
              onClick={() => changeStatus(t.next)}
            >
              <Icon className="w-3.5 h-3.5" />
              {loading === t.next ? 'Guardando…' : isApprovedPending ? 'Confirmar aprobación' : t.label}
            </Button>
          )
        })}

        {showApprovedForm && (
          <Button
            size="sm"
            variant="outline"
            className="w-full"
            onClick={() => setShowApprovedForm(false)}
          >
            Cancelar
          </Button>
        )}

        {error && <p className="text-xs text-red-600">{error}</p>}
      </CardContent>
    </Card>
  )
}
