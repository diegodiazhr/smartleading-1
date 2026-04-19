'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  Building2, MapPin, Users, Sparkles,
  ChevronRight, ChevronLeft, CheckCircle2,
} from 'lucide-react'

const CCAA = [
  'Andalucía', 'Aragón', 'Principado de Asturias', 'Illes Balears', 'Canarias',
  'Cantabria', 'Castilla y León', 'Castilla-La Mancha', 'Catalunya', 'Extremadura',
  'Galicia', 'Comunidad de Madrid', 'Región de Murcia', 'Navarra', 'País Vasco',
  'La Rioja', 'Comunitat Valenciana', 'Ceuta', 'Melilla',
]

const CNAE_COMMON = [
  { code: '0111', label: '0111 — Cultivo de cereales' },
  { code: '0115', label: '0115 — Cultivo de tabaco' },
  { code: '0121', label: '0121 — Viticultura' },
  { code: '0141', label: '0141 — Ganadería bovina' },
  { code: '0311', label: '0311 — Pesca marina' },
  { code: '1011', label: '1011 — Procesado y conservación de carne' },
  { code: '1071', label: '1071 — Fabricación de pan y pastelería' },
  { code: '1812', label: '1812 — Otras actividades de impresión' },
  { code: '2010', label: '2010 — Fabricación de productos químicos básicos' },
  { code: '2511', label: '2511 — Fabricación de estructuras metálicas' },
  { code: '2620', label: '2620 — Fabricación de ordenadores y periféricos' },
  { code: '2630', label: '2630 — Fabricación de equipos de telecomunicaciones' },
  { code: '3511', label: '3511 — Producción de energía eléctrica' },
  { code: '3530', label: '3530 — Suministro de vapor y aire acondicionado' },
  { code: '4110', label: '4110 — Promoción inmobiliaria' },
  { code: '4120', label: '4120 — Construcción de edificios residenciales' },
  { code: '4211', label: '4211 — Construcción de carreteras' },
  { code: '4221', label: '4221 — Tendido de oleoductos y gasoductos' },
  { code: '4312', label: '4312 — Preparación de terrenos' },
  { code: '4520', label: '4520 — Mantenimiento y reparación de vehículos' },
  { code: '4711', label: '4711 — Comercio al por menor no especializado' },
  { code: '4719', label: '4719 — Otro comercio al por menor no especializado' },
  { code: '4941', label: '4941 — Transporte de mercancías por carretera' },
  { code: '5210', label: '5210 — Depósito y almacenamiento' },
  { code: '5510', label: '5510 — Hoteles y alojamientos similares' },
  { code: '5610', label: '5610 — Restaurantes y puestos de comidas' },
  { code: '5630', label: '5630 — Establecimientos de bebidas' },
  { code: '5811', label: '5811 — Edición de libros' },
  { code: '5912', label: '5912 — Actividades de postproducción' },
  { code: '6201', label: '6201 — Actividades de programación informática' },
  { code: '6202', label: '6202 — Actividades de consultoría informática' },
  { code: '6209', label: '6209 — Otros servicios de tecnología de la información' },
  { code: '6311', label: '6311 — Proceso de datos, hosting y actividades relacionadas' },
  { code: '6312', label: '6312 — Portales web, buscadores y similares' },
  { code: '6420', label: '6420 — Actividades de las sociedades holding' },
  { code: '6499', label: '6499 — Otros servicios financieros' },
  { code: '6910', label: '6910 — Actividades jurídicas' },
  { code: '6920', label: '6920 — Actividades de contabilidad y auditoría' },
  { code: '7010', label: '7010 — Actividades de las sedes centrales' },
  { code: '7021', label: '7021 — Relaciones públicas y comunicación' },
  { code: '7022', label: '7022 — Otras consultorías de gestión empresarial' },
  { code: '7111', label: '7111 — Servicios técnicos de arquitectura' },
  { code: '7112', label: '7112 — Servicios técnicos de ingeniería' },
  { code: '7211', label: '7211 — Investigación y desarrollo en biotecnología' },
  { code: '7219', label: '7219 — I+D en otras ciencias naturales' },
  { code: '7311', label: '7311 — Agencias de publicidad' },
  { code: '7500', label: '7500 — Actividades veterinarias' },
  { code: '8121', label: '8121 — Limpieza general de edificios' },
  { code: '8211', label: '8211 — Servicios administrativos combinados' },
  { code: '8219', label: '8219 — Fotocopiado y preparación de documentos' },
  { code: '8532', label: '8532 — Educación secundaria técnica' },
  { code: '8542', label: '8542 — Educación terciaria técnica' },
  { code: '8559', label: '8559 — Otra educación n.c.o.p.' },
  { code: '8610', label: '8610 — Actividades hospitalarias' },
  { code: '8690', label: '8690 — Otras actividades sanitarias' },
  { code: '9001', label: '9001 — Artes escénicas' },
  { code: '9321', label: '9321 — Actividades de parques de atracciones' },
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
  cnae_secondary: string[]  // up to 3 additional CNAEs
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
  digitalization_level: number   // 1–5
  sustainability_focus: boolean
  has_tax_debts: boolean
  has_social_security_debts: boolean
}

const INITIAL: FormData = {
  name: '', cif: '', website: '',
  cnae_primary: '', cnae_other: '', cnae_secondary: [],
  employees_count: '', revenue_annual: '', founding_date: '',
  region: '', municipality: '',
  is_startup: false, has_rd: false, export_percentage: '0',
  digitalization_level: 3, sustainability_focus: false,
  has_tax_debts: false, has_social_security_debts: false,
}

const STEPS = [
  { id: 1, label: 'Empresa', icon: Building2 },
  { id: 2, label: 'Actividad', icon: Sparkles },
  { id: 3, label: 'Dimensión', icon: Users },
  { id: 4, label: 'Perfil', icon: MapPin },
]

const DIGITALIZATION_LABELS = [
  'Sin digitalización (papel/Excel)',
  'Básica (email, Word)',
  'Media (CRM, ERP básico)',
  'Avanzada (software integrado)',
  'Total (cloud, automatización)',
]

export default function CompanyWizard() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [form, setForm] = useState<FormData>(INITIAL)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cnaeSecondaryInput, setCnaeSecondaryInput] = useState('')

  function set<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  function addSecondaryChain(code: string) {
    const clean = code.trim()
    if (!clean || clean.length < 4) return
    if (form.cnae_secondary.includes(clean) || clean === (form.cnae_primary || form.cnae_other)) return
    if (form.cnae_secondary.length >= 3) return
    set('cnae_secondary', [...form.cnae_secondary, clean])
    setCnaeSecondaryInput('')
  }

  function removeSecondary(code: string) {
    set('cnae_secondary', form.cnae_secondary.filter(c => c !== code))
  }

  function canAdvance(): boolean {
    if (step === 1) return form.name.trim().length >= 2
    if (step === 2) return (form.cnae_primary || form.cnae_other).length >= 4
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
      cnae_secondary: form.cnae_secondary,
      employees_count: Number(form.employees_count) || 0,
      revenue_annual: Number(form.revenue_annual) || 0,
      revenue_growth: 0,
      founding_date: form.founding_date || null,
      region: form.region || null,
      municipality: form.municipality || null,
      is_startup: form.is_startup,
      has_rd: form.has_rd,
      export_percentage: Number(form.export_percentage) || 0,
      digitalization_level: form.digitalization_level,
      innovation_level: form.has_rd ? 5 : form.is_startup ? 4 : 3,
      sustainability_score: form.sustainability_focus ? 7 : 3,
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

      fetch('/api/matching', { method: 'POST' }).catch(() => null)
      router.push('/dashboard')
    } catch {
      setError('Error de conexión. Inténtalo de nuevo.')
      setLoading(false)
    }
  }

  const primaryCnae = form.cnae_primary || form.cnae_other

  return (
    <div style={{ width: '100%', maxWidth: 520 }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: 'var(--accent)', color: 'var(--accent-ink)',
          padding: '6px 14px', borderRadius: 999, fontSize: 13, fontWeight: 500,
          marginBottom: 14,
        }}>
          <Sparkles size={13} />
          Configura tu empresa
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 500, letterSpacing: '-0.02em', margin: 0 }}>
          Personaliza tu experiencia
        </h1>
        <p style={{ color: 'var(--fg-3)', fontSize: 13.5, marginTop: 8 }}>
          Cuanto más completes, más precisas serán tus subvenciones compatibles
        </p>
      </div>

      {/* Step indicator */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 24 }}>
        {STEPS.map((s, i) => {
          const Icon = s.icon
          const active = step === s.id
          const done = step > s.id
          return (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 5,
                fontSize: 12, fontWeight: 500, padding: '5px 10px', borderRadius: 999,
                background: active ? 'var(--accent)' : done ? 'var(--accent-soft)' : 'var(--bg-3)',
                color: active ? 'var(--accent-ink)' : done ? 'var(--accent-ink)' : 'var(--fg-4)',
                transition: 'all .15s ease',
              }}>
                {done ? <CheckCircle2 size={13} /> : <Icon size={13} />}
                {s.label}
              </div>
              {i < STEPS.length - 1 && (
                <div style={{ width: 20, height: 1, background: step > s.id ? 'var(--accent-soft-2)' : 'var(--line)' }} />
              )}
            </div>
          )
        })}
      </div>

      {/* Card */}
      <div style={{
        background: 'var(--bg)', border: '1px solid var(--line)',
        borderRadius: 14, padding: 28,
        boxShadow: 'var(--shadow-lg)',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* ── Step 1: Empresa ── */}
          {step === 1 && (
            <>
              <Field label="Nombre de la empresa" required>
                <input
                  placeholder="Acme Technologies S.L."
                  value={form.name}
                  onChange={e => set('name', e.target.value)}
                  style={inputStyle}
                />
              </Field>
              <Field label="CIF / NIF">
                <input
                  placeholder="B12345678"
                  value={form.cif}
                  onChange={e => set('cif', e.target.value.toUpperCase())}
                  style={inputStyle}
                />
              </Field>
              <Field label="Página web">
                <input
                  placeholder="https://acme.com"
                  value={form.website}
                  onChange={e => set('website', e.target.value)}
                  style={inputStyle}
                />
              </Field>
            </>
          )}

          {/* ── Step 2: Actividad ── */}
          {step === 2 && (
            <>
              <Field label="CNAE principal" required hint="Código de actividad económica principal (IAE o AEAT)">
                <select
                  value={form.cnae_primary}
                  onChange={e => set('cnae_primary', e.target.value)}
                  style={{ ...inputStyle, height: 42 }}
                >
                  <option value="">Selecciona tu actividad principal…</option>
                  {CNAE_COMMON.map(c => (
                    <option key={c.code} value={c.code}>{c.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="¿No está en la lista? Escribe el código CNAE">
                <input
                  placeholder="ej. 6201"
                  value={form.cnae_other}
                  onChange={e => set('cnae_other', e.target.value)}
                  disabled={!!form.cnae_primary}
                  style={{ ...inputStyle, opacity: form.cnae_primary ? 0.4 : 1 }}
                />
              </Field>

              {/* Secondary CNAEs */}
              <Field
                label="Actividades secundarias (opcional)"
                hint="Añade hasta 3 CNAEs adicionales para mejorar el matching"
              >
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    placeholder="ej. 7311"
                    value={cnaeSecondaryInput}
                    onChange={e => setCnaeSecondaryInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSecondaryChain(cnaeSecondaryInput) } }}
                    disabled={form.cnae_secondary.length >= 3}
                    style={{ ...inputStyle, flex: 1, opacity: form.cnae_secondary.length >= 3 ? 0.4 : 1 }}
                  />
                  <button
                    type="button"
                    onClick={() => addSecondaryChain(cnaeSecondaryInput)}
                    disabled={form.cnae_secondary.length >= 3 || cnaeSecondaryInput.length < 4}
                    style={{
                      padding: '0 14px', borderRadius: 8, height: 42,
                      border: '1px solid var(--accent)', background: 'var(--accent-soft)',
                      color: 'var(--accent-ink)', fontSize: 13, fontWeight: 500, cursor: 'pointer',
                    }}
                  >
                    Añadir
                  </button>
                </div>
                {form.cnae_secondary.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                    {form.cnae_secondary.map(code => (
                      <span key={code} style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 500,
                        background: 'var(--accent-soft)', color: 'var(--accent-ink)',
                        border: '1px solid var(--accent-soft-2)',
                      }}>
                        {code}
                        <button
                          type="button"
                          onClick={() => removeSecondary(code)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-ink)', padding: 0, fontSize: 14 }}
                        >×</button>
                      </span>
                    ))}
                  </div>
                )}
              </Field>

              {primaryCnae && (
                <div style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--accent-soft)', border: '1px solid var(--accent-soft-2)', fontSize: 12.5, color: 'var(--accent-ink)' }}>
                  ✓ CNAE principal: <strong>{primaryCnae}</strong>
                  {form.cnae_secondary.length > 0 && ` + ${form.cnae_secondary.length} secundario${form.cnae_secondary.length > 1 ? 's' : ''}`}
                </div>
              )}
            </>
          )}

          {/* ── Step 3: Dimensión ── */}
          {step === 3 && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Nº de empleados">
                  <input
                    type="number" min="0" placeholder="25"
                    value={form.employees_count}
                    onChange={e => set('employees_count', e.target.value)}
                    style={inputStyle}
                  />
                </Field>
                <Field label="Facturación anual (€)">
                  <input
                    type="number" min="0" placeholder="500000"
                    value={form.revenue_annual}
                    onChange={e => set('revenue_annual', e.target.value)}
                    style={inputStyle}
                  />
                </Field>
              </div>
              <Field label="Fecha de constitución">
                <input
                  type="date"
                  value={form.founding_date}
                  onChange={e => set('founding_date', e.target.value)}
                  style={inputStyle}
                />
              </Field>
              <div style={{ padding: '10px 12px', borderRadius: 8, background: 'oklch(0.97 0.03 70)', border: '1px solid oklch(0.92 0.06 65)', fontSize: 12.5, color: 'oklch(0.35 0.1 55)' }}>
                Usamos estos datos para filtrar convocatorias con requisitos de tamaño. No se comparten con terceros.
              </div>
            </>
          )}

          {/* ── Step 4: Perfil ── */}
          {step === 4 && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Comunidad Autónoma">
                  <select
                    value={form.region}
                    onChange={e => set('region', e.target.value)}
                    style={{ ...inputStyle, height: 42 }}
                  >
                    <option value="">Selecciona…</option>
                    {CCAA.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </Field>
                <Field label="Municipio">
                  <input
                    placeholder="Madrid"
                    value={form.municipality}
                    onChange={e => set('municipality', e.target.value)}
                    style={inputStyle}
                  />
                </Field>
              </div>

              {/* Characteristics */}
              <Field label="Tipo de empresa">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {[
                    { key: 'is_startup', label: 'Startup', desc: 'Empresa < 5 años con alto potencial de crecimiento' },
                    { key: 'has_rd', label: 'I+D / Innovación', desc: 'Realizas actividades de investigación o desarrollo' },
                  ].map(({ key, label, desc }) => (
                    <label key={key} style={{
                      display: 'flex', alignItems: 'flex-start', gap: 10,
                      padding: '10px 12px',
                      background: form[key as 'is_startup' | 'has_rd'] ? 'var(--accent-soft)' : 'var(--bg-2)',
                      border: `1px solid ${form[key as 'is_startup' | 'has_rd'] ? 'var(--accent-soft-2)' : 'var(--line)'}`,
                      borderRadius: 8, cursor: 'pointer',
                    }}>
                      <input
                        type="checkbox"
                        checked={form[key as 'is_startup' | 'has_rd']}
                        onChange={e => set(key as 'is_startup' | 'has_rd', e.target.checked)}
                        style={{ marginTop: 2, accentColor: 'var(--accent)' }}
                      />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg)' }}>{label}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--fg-3)', marginTop: 1 }}>{desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </Field>

              {/* Digitalization level */}
              <Field
                label={`Nivel de digitalización: ${DIGITALIZATION_LABELS[form.digitalization_level - 1]}`}
                hint="Impacta en subvenciones de Kit Digital, IA y transformación tecnológica"
              >
                <div style={{ display: 'flex', gap: 4 }}>
                  {[1, 2, 3, 4, 5].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => set('digitalization_level', n)}
                      style={{
                        flex: 1, height: 36, borderRadius: 8, fontSize: 13, fontWeight: 500,
                        border: `1px solid ${form.digitalization_level === n ? 'var(--accent)' : 'var(--line)'}`,
                        background: form.digitalization_level === n ? 'var(--accent)' : 'var(--bg)',
                        color: form.digitalization_level === n ? 'var(--accent-ink)' : 'var(--fg-3)',
                        cursor: 'pointer',
                      }}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                  <span style={{ fontSize: 10.5, color: 'var(--fg-4)' }}>Mínima</span>
                  <span style={{ fontSize: 10.5, color: 'var(--fg-4)' }}>Total</span>
                </div>
              </Field>

              {/* Sustainability */}
              <label style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                padding: '10px 12px',
                border: `1px solid ${form.sustainability_focus ? 'oklch(0.75 0.12 150)' : 'var(--line)'}`,
                borderRadius: 8, cursor: 'pointer',
                background: form.sustainability_focus ? 'oklch(0.97 0.04 150)' : 'var(--bg-2)',
              }}>
                <input
                  type="checkbox"
                  checked={form.sustainability_focus}
                  onChange={e => set('sustainability_focus', e.target.checked)}
                  style={{ marginTop: 2, accentColor: 'oklch(0.65 0.14 150)' }}
                />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg)' }}>Sostenibilidad / Economía verde</div>
                  <div style={{ fontSize: 11.5, color: 'var(--fg-3)', marginTop: 1 }}>Tienes o quieres proyectos relacionados con eficiencia energética, economía circular o medioambiente</div>
                </div>
              </label>

              {/* Export */}
              <Field label="% ventas al exterior (exportación)">
                <input
                  type="number" min="0" max="100" placeholder="0"
                  value={form.export_percentage}
                  onChange={e => set('export_percentage', e.target.value)}
                  style={inputStyle}
                />
              </Field>

              {/* Fiscal */}
              <Field label="Situación fiscal">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {[
                    { key: 'has_tax_debts', label: 'Deudas con la AEAT', desc: 'Tengo deudas pendientes con la Agencia Tributaria' },
                    { key: 'has_social_security_debts', label: 'Deudas con la SS', desc: 'Tengo deudas pendientes con la Seguridad Social' },
                  ].map(({ key, label, desc }) => (
                    <label key={key} style={{
                      display: 'flex', alignItems: 'flex-start', gap: 10,
                      padding: '10px 12px', background: 'var(--bg-2)',
                      border: '1px solid var(--line)', borderRadius: 8, cursor: 'pointer',
                    }}>
                      <input
                        type="checkbox"
                        checked={form[key as 'has_tax_debts' | 'has_social_security_debts']}
                        onChange={e => set(key as 'has_tax_debts' | 'has_social_security_debts', e.target.checked)}
                        style={{ marginTop: 2, accentColor: 'var(--danger)' }}
                      />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg)' }}>{label}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--fg-3)', marginTop: 1 }}>{desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </Field>
            </>
          )}

          {error && (
            <div style={{ padding: '10px 12px', borderRadius: 8, background: 'oklch(0.95 0.05 25)', border: '1px solid oklch(0.9 0.08 25)', color: 'var(--danger)', fontSize: 13 }}>
              {error}
            </div>
          )}

          {/* Navigation */}
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8 }}>
            <button
              type="button"
              onClick={() => setStep(s => s - 1)}
              disabled={step === 1 || loading}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px',
                borderRadius: 8, fontSize: 13.5, fontWeight: 500, cursor: step === 1 ? 'not-allowed' : 'pointer',
                border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--fg-2)',
                opacity: step === 1 ? 0.4 : 1,
              }}
            >
              <ChevronLeft size={15} />
              Anterior
            </button>

            {step < 4 ? (
              <button
                type="button"
                onClick={() => setStep(s => s + 1)}
                disabled={!canAdvance()}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '9px 20px',
                  borderRadius: 8, fontSize: 13.5, fontWeight: 500,
                  border: '1px solid var(--accent)', background: 'var(--accent)', color: 'var(--accent-ink)',
                  cursor: canAdvance() ? 'pointer' : 'not-allowed',
                  opacity: canAdvance() ? 1 : 0.5,
                }}
              >
                Siguiente
                <ChevronRight size={15} />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '9px 20px',
                  borderRadius: 8, fontSize: 13.5, fontWeight: 500,
                  border: '1px solid var(--accent)', background: 'var(--accent)', color: 'var(--accent-ink)',
                  cursor: loading ? 'not-allowed' : 'pointer',
                }}
              >
                {loading ? 'Guardando…' : 'Finalizar y entrar'}
                {!loading && <CheckCircle2 size={15} />}
              </button>
            )}
          </div>
        </div>
      </div>

      <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--fg-4)', marginTop: 14 }}>
        Podrás editar estos datos en cualquier momento desde Mi Empresa
      </p>
    </div>
  )
}

// ── Shared sub-components ─────────────────────────────────────────��─────────

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px',
  border: '1px solid var(--line-2)', background: 'var(--bg)',
  borderRadius: 8, fontSize: 14, fontFamily: 'inherit', color: 'var(--fg)',
  outline: 'none', height: 42,
}

function Field({ label, required, hint, children }: {
  label: string
  required?: boolean
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label style={{ fontSize: 13, color: 'var(--fg-2)', display: 'block', marginBottom: 6, fontWeight: 500 }}>
        {label}
        {required && <span style={{ color: 'var(--danger)', marginLeft: 3 }}>*</span>}
      </label>
      {hint && <p style={{ fontSize: 11.5, color: 'var(--fg-4)', margin: '-2px 0 6px' }}>{hint}</p>}
      {children}
    </div>
  )
}
