'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import {
  ArrowLeft,
  Building,
  Calendar,
  Euro,
  FileText,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react'
import { formatCurrency, formatDate, daysUntil, urgencyLabel, grantTypeLabel, statusLabel } from '@/lib/utils'

interface Grant {
  id: string
  title: string
  organismo: string | null
  deadline: string | null
  budget_per_company_min: number | null
  budget_per_company_max: number | null
  grant_type: string
  scope: string
  summary: string | null
  status: string
}

interface Props {
  grant: Grant
  existingApplicationId: string | null
}

export default function NuevoExpedienteForm({ grant, existingApplicationId }: Props) {
  const router = useRouter()
  const [amount, setAmount] = useState<string>(
    grant.budget_per_company_max ? String(grant.budget_per_company_max) : ''
  )
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const days = daysUntil(grant.deadline)
  const { label: urgLabel, color: urgColor } = urgencyLabel(days)
  const { label: statusLbl, color: statusColor } = statusLabel(grant.status)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grant_id: grant.id,
          requested_amount: amount ? Number(amount) : null,
          notes: notes || null,
        }),
      })
      const data = await res.json() as { application?: { id: string }; error?: string }

      if (!res.ok || !data.application) {
        setError(data.error ?? 'Error al crear el expediente')
        return
      }

      router.push(`/dashboard/expedientes/${data.application.id}`)
    } catch {
      setError('Error de conexión. Inténtalo de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  if (existingApplicationId) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-6 flex items-start gap-4">
            <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-900">Ya tienes un expediente para esta subvención</p>
              <p className="text-sm text-amber-700 mt-1">
                No puedes crear dos expedientes para la misma convocatoria.
              </p>
              <div className="flex gap-3 mt-4">
                <Link href={`/dashboard/expedientes/${existingApplicationId}`}>
                  <Button size="sm">Ver expediente existente</Button>
                </Link>
                <Link href="/dashboard/subvenciones">
                  <Button size="sm" variant="outline">Volver al buscador</Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <Link href={`/dashboard/subvenciones/${grant.id}`} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="w-4 h-4" />
        Volver a la subvención
      </Link>

      {/* Grant summary card */}
      <Card className="border-indigo-100 bg-indigo-50/30">
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor}`}>
                  {statusLbl}
                </span>
                <Badge variant="secondary" className="text-xs">{grant.scope}</Badge>
                <Badge variant="success" className="text-xs">{grantTypeLabel(grant.grant_type)}</Badge>
              </div>
              <h2 className="font-bold text-gray-900 text-base leading-snug">{grant.title}</h2>
              {grant.organismo && (
                <p className="text-sm text-gray-500 mt-0.5 flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5" />
                  {grant.organismo}
                </p>
              )}
              {grant.summary && (
                <p className="text-xs text-gray-600 mt-2 line-clamp-2">{grant.summary}</p>
              )}
            </div>
            <div className="shrink-0 text-right space-y-1.5">
              {grant.budget_per_company_max && (
                <div>
                  <p className="text-xs text-gray-400">Hasta</p>
                  <p className="font-bold text-emerald-700 text-base">{formatCurrency(grant.budget_per_company_max)}</p>
                </div>
              )}
              <div className={`flex items-center gap-1 justify-end ${urgColor}`}>
                <Calendar className="w-3.5 h-3.5" />
                <span className="text-xs font-medium">{urgLabel}</span>
              </div>
              {grant.deadline && (
                <p className="text-xs text-gray-400">{formatDate(grant.deadline)}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Form */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileText className="w-4 h-4 text-indigo-500" />
            Datos de la solicitud
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1.5">
                Importe a solicitar (€)
              </label>
              <div className="relative">
                <Euro className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  type="number"
                  min={grant.budget_per_company_min ?? 0}
                  max={grant.budget_per_company_max ?? undefined}
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="0"
                  className="pl-9"
                />
              </div>
              {grant.budget_per_company_min && grant.budget_per_company_max && (
                <p className="text-xs text-gray-400 mt-1">
                  Rango: {formatCurrency(grant.budget_per_company_min)} – {formatCurrency(grant.budget_per_company_max)}
                </p>
              )}
            </div>

            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1.5">
                Notas internas <span className="text-gray-400 font-normal">(opcional)</span>
              </label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                placeholder="Añade contexto, referencias internas o notas para tu equipo..."
                className="w-full text-sm rounded-lg border border-gray-200 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            <div className="flex items-center gap-3 pt-1">
              <Link href={`/dashboard/subvenciones/${grant.id}`}>
                <Button type="button" variant="outline">Cancelar</Button>
              </Link>
              <Button type="submit" disabled={submitting} className="ml-auto gap-2">
                {submitting ? 'Creando expediente…' : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Crear expediente
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
