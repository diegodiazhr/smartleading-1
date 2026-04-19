'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Company } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils'
import {
  Building2, MapPin, Users, Euro, Calendar, Globe,
  Pencil, RefreshCw, CheckCircle2, Target, AlertTriangle,
} from 'lucide-react'

const CCAA = [
  'Andalucía', 'Aragón', 'Principado de Asturias', 'Illes Balears', 'Canarias',
  'Cantabria', 'Castilla y León', 'Castilla-La Mancha', 'Catalunya', 'Extremadura',
  'Galicia', 'Comunidad de Madrid', 'Región de Murcia', 'Navarra', 'País Vasco',
  'La Rioja', 'Comunitat Valenciana', 'Ceuta', 'Melilla',
]

interface Props {
  company: Company
  matchCount: number
}

interface MatchStats {
  totalGrants: number
  matched: number
  highFit: number
  totalPotential: number
  durationMs: number
}

export default function EmpresaProfile({ company: initial, matchCount }: Props) {
  const router = useRouter()
  const [company, setCompany] = useState(initial)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [matching, setMatching] = useState(false)
  const [matchStats, setMatchStats] = useState<MatchStats | null>(null)
  const [error, setError] = useState<string | null>(null)

  function setField<K extends keyof Company>(key: K, value: Company[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/empresa', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Error al guardar'); return }
      setCompany(data.company)
      setEditing(false)
    } catch {
      setError('Error de conexión')
    } finally {
      setSaving(false)
    }
  }

  async function handleMatching() {
    setMatching(true)
    setError(null)
    setMatchStats(null)
    try {
      const res = await fetch('/api/matching', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Error en el matching'); return }
      setMatchStats(data.stats)
      router.refresh()
    } catch {
      setError('Error al ejecutar el matching')
    } finally {
      setMatching(false)
    }
  }

  const hasDebts = company.has_tax_debts || company.has_social_security_debts

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Header card */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-indigo-100 rounded-xl flex items-center justify-center shrink-0">
                <Building2 className="w-7 h-7 text-indigo-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">{company.name}</h2>
                <p className="text-sm text-gray-500">{company.cif} · {company.region ?? 'Sin región'}</p>
                <div className="flex gap-2 mt-1.5 flex-wrap">
                  {company.is_startup && <Badge variant="blue">Startup</Badge>}
                  {company.has_rd && <Badge variant="success">I+D</Badge>}
                  {company.export_percentage > 0 && (
                    <Badge variant="secondary">Exporta {company.export_percentage}%</Badge>
                  )}
                  {hasDebts && <Badge variant="destructive">Deudas fiscales</Badge>}
                </div>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setEditing(!editing); setForm(company) }}
              className="gap-2 shrink-0"
            >
              <Pencil className="w-3.5 h-3.5" />
              {editing ? 'Cancelar' : 'Editar'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Matching card */}
      <Card className="border-indigo-100 bg-indigo-50/30">
        <CardContent className="p-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <Target className="w-5 h-5 text-indigo-600" />
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  {matchCount > 0
                    ? `${matchCount} subvenciones compatibles encontradas`
                    : 'Ejecuta el matching para ver subvenciones'}
                </p>
                <p className="text-xs text-gray-500">
                  El motor analiza todas las convocatorias activas frente a tu perfil
                </p>
              </div>
            </div>
            <Button
              size="sm"
              onClick={handleMatching}
              disabled={matching}
              className="gap-2 bg-indigo-600 hover:bg-indigo-700 shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${matching ? 'animate-spin' : ''}`} />
              {matching ? 'Calculando…' : 'Recalcular matching'}
            </Button>
          </div>

          {matchStats && (
            <div className="mt-3 p-3 bg-white rounded-lg border border-emerald-200 text-xs space-y-1">
              <div className="flex items-center gap-1.5 text-emerald-700 font-semibold">
                <CheckCircle2 className="w-4 h-4" />
                Matching completado
              </div>
              <div className="grid grid-cols-3 gap-3 mt-2 text-gray-600">
                <div><p className="text-gray-400">Compatibles</p><p className="font-semibold text-gray-800">{matchStats.matched}</p></div>
                <div><p className="text-gray-400">Alta afinidad</p><p className="font-semibold text-gray-800">{matchStats.highFit}</p></div>
                <div><p className="text-gray-400">Potencial</p><p className="font-semibold text-emerald-700">{formatCurrency(matchStats.totalPotential)}</p></div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {hasDebts && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-900">Deudas fiscales detectadas</p>
              <p className="text-xs text-amber-700 mt-0.5">
                Las deudas con Hacienda o la Seguridad Social impiden presentar solicitudes de subvenciones.
                Regulariza tu situación antes de solicitar cualquier convocatoria.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Profile data / edit form */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Building2 className="w-4 h-4 text-indigo-500" />
              Datos generales
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            {editing ? (
              <>
                <Field label="Nombre">
                  <Input value={form.name} onChange={e => setField('name', e.target.value)} />
                </Field>
                <Field label="CIF">
                  <Input value={form.cif} onChange={e => setField('cif', e.target.value.toUpperCase())} />
                </Field>
                <Field label="Web">
                  <Input value={form.website ?? ''} onChange={e => setField('website', e.target.value)} />
                </Field>
                <Field label="CNAE principal">
                  <Input value={form.cnae_primary ?? ''} onChange={e => setField('cnae_primary', e.target.value)} />
                </Field>
                <Field label="Fecha constitución">
                  <Input type="date" value={form.founding_date ?? ''} onChange={e => setField('founding_date', e.target.value)} />
                </Field>
              </>
            ) : (
              <>
                <InfoRow icon={Building2} label="CIF" value={company.cif || '—'} />
                <InfoRow icon={Globe} label="Web" value={company.website || '—'} />
                <InfoRow icon={Target} label="CNAE" value={company.cnae_primary || '—'} />
                <InfoRow icon={Calendar} label="Constitución" value={company.founding_date ? new Date(company.founding_date).getFullYear().toString() : '—'} />
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-500" />
              Dimensión y ubicación
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            {editing ? (
              <>
                <Field label="Empleados">
                  <Input type="number" value={form.employees_count} onChange={e => setField('employees_count', Number(e.target.value))} />
                </Field>
                <Field label="Facturación (€)">
                  <Input type="number" value={form.revenue_annual} onChange={e => setField('revenue_annual', Number(e.target.value))} />
                </Field>
                <Field label="Comunidad Autónoma">
                  <select
                    value={form.region ?? ''}
                    onChange={e => setField('region', e.target.value || null)}
                    className="w-full h-10 text-sm rounded-lg border border-gray-200 bg-white px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Sin especificar</option>
                    {CCAA.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </Field>
                <Field label="Municipio">
                  <Input value={form.municipality ?? ''} onChange={e => setField('municipality', e.target.value || null)} />
                </Field>
                <Field label="% Exportación">
                  <Input type="number" min="0" max="100" value={form.export_percentage} onChange={e => setField('export_percentage', Number(e.target.value))} />
                </Field>
              </>
            ) : (
              <>
                <InfoRow icon={Users} label="Empleados" value={company.employees_count.toString()} />
                <InfoRow icon={Euro} label="Facturación" value={formatCurrency(company.revenue_annual)} />
                <InfoRow icon={MapPin} label="Región" value={company.region || '—'} />
                <InfoRow icon={MapPin} label="Municipio" value={company.municipality || '—'} />
                <InfoRow icon={Globe} label="Exportación" value={`${company.export_percentage}%`} />
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {editing && (
        <div className="flex items-center gap-3">
          {error && <p className="text-sm text-red-600 flex-1">{error}</p>}
          <Button onClick={handleSave} disabled={saving} className="ml-auto gap-2">
            {saving ? 'Guardando…' : 'Guardar cambios'}
            {!saving && <CheckCircle2 className="w-4 h-4" />}
          </Button>
        </div>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium text-gray-500 block mb-1">{label}</label>
      {children}
    </div>
  )
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
      <span className="text-xs text-gray-500 w-20 shrink-0">{label}</span>
      <span className="text-sm text-gray-900 font-medium">{value}</span>
    </div>
  )
}
