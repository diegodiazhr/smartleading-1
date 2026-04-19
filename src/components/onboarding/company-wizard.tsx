'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { Building2, MapPin, Users, Sparkles, ChevronRight, ChevronLeft, CheckCircle2 } from 'lucide-react'

const CCAA = [
  'Andalucía', 'Aragón', 'Principado de Asturias', 'Illes Balears', 'Canarias',
  'Cantabria', 'Castilla y León', 'Castilla-La Mancha', 'Catalunya', 'Extremadura',
  'Galicia', 'Comunidad de Madrid', 'Región de Murcia', 'Navarra', 'País Vasco',
  'La Rioja', 'Comunitat Valenciana', 'Ceuta', 'Melilla',
]

const CNAE_COMMON = [
  { code: '0111', label: '0111 — Cultivo de cereales' },
  { code: '1011', label: '1011 — Procesado y conservación de carne' },
  { code: '2010', label: '2010 — Fabricación de productos químicos básicos' },
  { code: '2511', label: '2511 — Fabricación de estructuras metálicas' },
  { code: '2620', label: '2620 — Fabricación de ordenadores y periféricos' },
  { code: '2630', label: '2630 — Fabricación de equipos de telecomunicaciones' },
  { code: '2812', label: '2812 — Fabricación de equipos de potencia hidráulica' },
  { code: '3511', label: '3511 — Producción de energía eléctrica' },
  { code: '4110', label: '4110 — Promoción inmobiliaria' },
  { code: '4211', label: '4211 — Construcción de carreteras' },
  { code: '4520', label: '4520 — Mantenimiento y reparación de vehículos' },
  { code: '4711', label: '4711 — Comercio al por menor en establecimientos no especializados' },
  { code: '5610', label: '5610 — Restaurantes y puestos de comidas' },
  { code: '5811', label: '5811 — Edición de libros' },
  { code: '6201', label: '6201 — Actividades de programación informática' },
  { code: '6202', label: '6202 — Actividades de consultoría informática' },
  { code: '6209', label: '6209 — Otros servicios de tecnología de la información' },
  { code: '6311', label: '6311 — Proceso de datos, hosting y actividades relacionadas' },
  { code: '6420', label: '6420 — Actividades de las sociedades holding' },
  { code: '6910', label: '6910 — Actividades jurídicas' },
  { code: '6920', label: '6920 — Actividades de contabilidad' },
  { code: '7010', label: '7010 — Actividades de las sedes centrales' },
  { code: '7021', label: '7021 — Relaciones públicas y comunicación' },
  { code: '7022', label: '7022 — Otras consultorías de gestión empresarial' },
  { code: '7111', label: '7111 — Servicios técnicos de arquitectura' },
  { code: '7112', label: '7112 — Servicios técnicos de ingeniería' },
  { code: '7211', label: '7211 — Investigación y desarrollo en biotecnología' },
  { code: '7219', label: '7219 — I+D en otras ciencias naturales y exactas' },
  { code: '7220', label: '7220 — Investigación y desarrollo en ciencias sociales' },
  { code: '7311', label: '7311 — Agencias de publicidad' },
  { code: '8211', label: '8211 — Servicios administrativos combinados' },
  { code: '8219', label: '8219 — Fotocopiado, preparación de documentos' },
  { code: '8532', label: '8532 — Educación secundaria técnica' },
  { code: '8542', label: '8542 — Educación terciaria técnica' },
  { code: '8559', label: '8559 — Otra educación n.c.o.p.' },
  { code: '8610', label: '8610 — Actividades hospitalarias' },
  { code: '8690', label: '8690 — Otras actividades sanitarias' },
  { code: '9001', label: '9001 — Artes escénicas' },
  { code: '9499', label: '9499 — Otras actividades asociativas' },
]

interface FormData {
  // Step 1 — Empresa
  name: string
  cif: string
  website: string
  // Step 2 — Actividad
  cnae_primary: string
  cnae_other: string
  // Step 3 — Dimensión
  employees_count: string
  revenue_annual: string
  founding_date: string
  // Step 4 — Ubicación & perfil
  region: string
  municipality: string
  is_startup: boolean
  has_rd: boolean
  export_percentage: string
  has_tax_debts: boolean
  has_social_security_debts: boolean
}

const INITIAL: FormData = {
  name: '', cif: '', website: '',
  cnae_primary: '', cnae_other: '',
  employees_count: '', revenue_annual: '', founding_date: '',
  region: '', municipality: '',
  is_startup: false, has_rd: false, export_percentage: '0',
  has_tax_debts: false, has_social_security_debts: false,
}

const STEPS = [
  { id: 1, label: 'Empresa', icon: Building2 },
  { id: 2, label: 'Actividad', icon: Sparkles },
  { id: 3, label: 'Dimensión', icon: Users },
  { id: 4, label: 'Perfil', icon: MapPin },
]

export default function CompanyWizard() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [form, setForm] = useState<FormData>(INITIAL)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  function canAdvance(): boolean {
    if (step === 1) return form.name.trim().length >= 2
    if (step === 2) return form.cnae_primary.length >= 4 || form.cnae_other.length >= 4
    if (step === 3) return Number(form.employees_count) >= 0 && Number(form.revenue_annual) >= 0
    return true
  }

  async function handleSubmit() {
    setLoading(true)
    setError(null)

    const cnae = form.cnae_primary || form.cnae_other

    const payload = {
      name: form.name,
      cif: form.cif,
      website: form.website || null,
      cnae_primary: cnae || null,
      cnae_secondary: [],
      employees_count: Number(form.employees_count) || 0,
      revenue_annual: Number(form.revenue_annual) || 0,
      revenue_growth: 0,
      founding_date: form.founding_date || null,
      region: form.region || null,
      municipality: form.municipality || null,
      is_startup: form.is_startup,
      has_rd: form.has_rd,
      export_percentage: Number(form.export_percentage) || 0,
      digitalization_level: 3,
      innovation_level: form.has_rd ? 5 : 3,
      sustainability_score: 3,
      has_tax_debts: form.has_tax_debts,
      has_social_security_debts: form.has_social_security_debts,
    }

    try {
      const res = await fetch('/api/empresa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Error al guardar la empresa')
        setLoading(false)
        return
      }

      // Trigger matching in background (fire & forget)
      fetch('/api/matching', { method: 'POST' }).catch(() => null)

      router.push('/dashboard')
    } catch {
      setError('Error de conexión. Inténtalo de nuevo.')
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-xl">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-1.5 rounded-full text-sm font-medium mb-4">
          <Sparkles className="w-3.5 h-3.5" />
          Configura tu empresa
        </div>
        <h1 className="text-2xl font-bold text-gray-900">
          Personaliza tu experiencia
        </h1>
        <p className="text-gray-500 text-sm mt-2">
          Con estos datos encontraremos las subvenciones más relevantes para ti
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {STEPS.map((s, i) => {
          const Icon = s.icon
          const active = step === s.id
          const done = step > s.id
          return (
            <div key={s.id} className="flex items-center gap-2">
              <div
                className={cn(
                  'flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full transition-all',
                  active && 'bg-indigo-600 text-white',
                  done && 'bg-indigo-100 text-indigo-700',
                  !active && !done && 'bg-gray-100 text-gray-400',
                )}
              >
                {done ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
                {s.label}
              </div>
              {i < STEPS.length - 1 && (
                <div className={cn('w-6 h-px', step > s.id ? 'bg-indigo-300' : 'bg-gray-200')} />
              )}
            </div>
          )
        })}
      </div>

      <Card className="shadow-lg border-0">
        <CardContent className="p-7 space-y-5">
          {/* ── Step 1: Empresa ── */}
          {step === 1 && (
            <>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">
                  Nombre de la empresa <span className="text-red-500">*</span>
                </label>
                <Input
                  placeholder="Acme Technologies S.L."
                  value={form.name}
                  onChange={e => set('name', e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">CIF / NIF</label>
                <Input
                  placeholder="B12345678"
                  value={form.cif}
                  onChange={e => set('cif', e.target.value.toUpperCase())}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">Página web</label>
                <Input
                  placeholder="https://acme.com"
                  value={form.website}
                  onChange={e => set('website', e.target.value)}
                />
              </div>
            </>
          )}

          {/* ── Step 2: Actividad ── */}
          {step === 2 && (
            <>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">
                  CNAE principal <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.cnae_primary}
                  onChange={e => set('cnae_primary', e.target.value)}
                  className="w-full h-10 text-sm rounded-lg border border-gray-200 bg-white px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Selecciona tu actividad principal…</option>
                  {CNAE_COMMON.map(c => (
                    <option key={c.code} value={c.code}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">
                  ¿No está en la lista? Escribe el código CNAE
                </label>
                <Input
                  placeholder="ej. 6201"
                  value={form.cnae_other}
                  onChange={e => set('cnae_other', e.target.value)}
                  disabled={!!form.cnae_primary}
                />
                {form.cnae_primary && (
                  <p className="text-xs text-gray-400 mt-1">Desactiva la selección de arriba para escribir manualmente</p>
                )}
              </div>
              <div className="p-3 bg-indigo-50 rounded-lg text-xs text-indigo-700">
                El CNAE es el código de actividad económica de tu empresa. Lo encontrarás en el recibo del IAE o en el certificado de la Agencia Tributaria.
              </div>
            </>
          )}

          {/* ── Step 3: Dimensión ── */}
          {step === 3 && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1.5">
                    Nº de empleados
                  </label>
                  <Input
                    type="number"
                    min="0"
                    placeholder="25"
                    value={form.employees_count}
                    onChange={e => set('employees_count', e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1.5">
                    Facturación anual (€)
                  </label>
                  <Input
                    type="number"
                    min="0"
                    placeholder="500000"
                    value={form.revenue_annual}
                    onChange={e => set('revenue_annual', e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">
                  Fecha de constitución
                </label>
                <Input
                  type="date"
                  value={form.founding_date}
                  onChange={e => set('founding_date', e.target.value)}
                />
              </div>
              <div className="p-3 bg-amber-50 rounded-lg text-xs text-amber-700">
                Estos datos se usan para filtrar convocatorias con requisitos de tamaño. No se comparten con terceros.
              </div>
            </>
          )}

          {/* ── Step 4: Ubicación & Perfil ── */}
          {step === 4 && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1.5">
                    Comunidad Autónoma
                  </label>
                  <select
                    value={form.region}
                    onChange={e => set('region', e.target.value)}
                    className="w-full h-10 text-sm rounded-lg border border-gray-200 bg-white px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Selecciona…</option>
                    {CCAA.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1.5">Municipio</label>
                  <Input
                    placeholder="Madrid"
                    value={form.municipality}
                    onChange={e => set('municipality', e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-2">
                  Características de la empresa
                </label>
                <div className="space-y-2">
                  {[
                    { key: 'is_startup', label: 'Es una startup (< 5 años, alto crecimiento)' },
                    { key: 'has_rd', label: 'Realiza actividades de I+D o innovación' },
                  ].map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
                      <input
                        type="checkbox"
                        checked={form[key as 'is_startup' | 'has_rd']}
                        onChange={e => set(key as 'is_startup' | 'has_rd', e.target.checked)}
                        className="w-4 h-4 rounded text-indigo-600"
                      />
                      <span className="text-sm text-gray-700">{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">
                  % ventas al exterior (exportación)
                </label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  placeholder="0"
                  value={form.export_percentage}
                  onChange={e => set('export_percentage', e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-2">
                  Situación fiscal
                </label>
                <div className="space-y-2">
                  {[
                    { key: 'has_tax_debts', label: 'Tengo deudas con la Agencia Tributaria (AEAT)' },
                    { key: 'has_social_security_debts', label: 'Tengo deudas con la Seguridad Social' },
                  ].map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors">
                      <input
                        type="checkbox"
                        checked={form[key as 'has_tax_debts' | 'has_social_security_debts']}
                        onChange={e => set(key as 'has_tax_debts' | 'has_social_security_debts', e.target.checked)}
                        className="w-4 h-4 rounded text-indigo-600"
                      />
                      <span className="text-sm text-gray-700">{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {/* Navigation */}
          <div className="flex justify-between pt-2">
            <Button
              variant="outline"
              onClick={() => setStep(s => s - 1)}
              disabled={step === 1 || loading}
              className="gap-2"
            >
              <ChevronLeft className="w-4 h-4" />
              Anterior
            </Button>

            {step < 4 ? (
              <Button
                onClick={() => setStep(s => s + 1)}
                disabled={!canAdvance()}
                className="gap-2"
              >
                Siguiente
                <ChevronRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={loading}
                className="gap-2 bg-indigo-600 hover:bg-indigo-700"
              >
                {loading ? 'Guardando…' : 'Finalizar y entrar'}
                {!loading && <CheckCircle2 className="w-4 h-4" />}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <p className="text-center text-xs text-gray-400 mt-4">
        Podrás editar estos datos en cualquier momento desde Mi Empresa
      </p>
    </div>
  )
}
