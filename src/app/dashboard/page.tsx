import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Header from '@/components/dashboard/header'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { formatCurrency, formatDate, daysUntil, statusLabel } from '@/lib/utils'
import type { GrantMatch, Grant } from '@/lib/types'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  const { data: userRecord } = await admin
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  const { data: company } = userRecord?.organization_id
    ? await admin.from('companies').select('id, name').eq('organization_id', userRecord.organization_id).single()
    : { data: null }

  const [applicationsResult, alertsResult, tasksResult, matchesResult] = await Promise.all([
    supabase
      .from('applications')
      .select('*, grant:grants(title, deadline, budget_per_company_max, organismo)')
      .order('updated_at', { ascending: false })
      .limit(10),
    supabase
      .from('alerts')
      .select('*, grant:grants(title)')
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('tasks')
      .select('*')
      .neq('status', 'completed')
      .order('due_date', { ascending: true })
      .limit(5),
    company
      ? admin
          .from('company_grant_matches')
          .select('*, grant:grants(*)')
          .eq('company_id', company.id)
          .gte('eligibility_score', 40)
          .order('eligibility_score', { ascending: false })
          .limit(50)
      : Promise.resolve({ data: [] }),
  ])

  const applications = applicationsResult.data || []
  const alerts = alertsResult.data || []
  const tasks = tasksResult.data || []
  const matches = (matchesResult.data || []) as (GrantMatch & { grant: Grant })[]

  const totalRequested = applications.reduce((s, a) => s + (a.requested_amount || 0), 0)
  const totalApproved = applications
    .filter(a => ['approved', 'pending_justification', 'justified'].includes(a.status))
    .reduce((s, a) => s + (a.approved_amount || 0), 0)
  const activeApps = applications.filter(a => !['closed', 'denied'].includes(a.status)).length
  const totalPotential = matches.reduce((s, m) => s + (m.potential_amount || 0), 0)

  const highFit = matches.filter(m => m.eligibility_score >= 70)
  const medFit = matches.filter(m => m.eligibility_score >= 50 && m.eligibility_score < 70)
  const eligible = matches.filter(m => m.eligibility_score >= 40 && m.eligibility_score < 50)

  const urgentMatches = matches
    .filter(m => m.grant && daysUntil(m.grant.deadline) !== null && (daysUntil(m.grant.deadline) ?? 999) <= 30)
    .sort((a, b) => (daysUntil(a.grant?.deadline) ?? 999) - (daysUntil(b.grant?.deadline) ?? 999))
    .slice(0, 3)

  const topRecs = highFit.slice(0, 3)

  const today = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })
  const todayCap = today.charAt(0).toUpperCase() + today.slice(1)

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Header title="Dashboard" />

      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px 48px', maxWidth: 1400 }}>

        {/* Greeting */}
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 500, letterSpacing: '-0.02em', margin: 0 }}>Dashboard</h1>
            <div style={{ color: 'var(--fg-3)', fontSize: 13.5, marginTop: 4 }}>
              Bienvenido, <b style={{ color: 'var(--fg)', fontWeight: 500 }}>{company?.name?.toUpperCase() ?? user.email}</b> · {todayCap}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '0 12px', height: 34,
              border: '1px solid var(--line)', borderRadius: 8, background: 'var(--bg)',
              color: 'var(--fg-2)', fontSize: 12.5, cursor: 'pointer',
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5"/></svg>
              Actualizar
            </button>
            <button style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '0 12px', height: 34,
              border: '1px solid var(--line)', borderRadius: 8, background: 'var(--bg)',
              color: 'var(--fg-2)', fontSize: 12.5, cursor: 'pointer',
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></svg>
              Exportar
            </button>
          </div>
        </div>

        {/* Hero card */}
        <div style={{
          position: 'relative', overflow: 'hidden', borderRadius: 16,
          background: 'linear-gradient(135deg, oklch(0.72 0.17 55) 0%, oklch(0.68 0.19 40) 100%)',
          color: 'oklch(0.22 0.08 45)', padding: '28px 32px', marginBottom: 16,
        }}>
          {/* Grid overlay */}
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            backgroundImage: 'linear-gradient(to right, oklch(0.3 0.1 50 / 0.08) 1px, transparent 1px), linear-gradient(to bottom, oklch(0.3 0.1 50 / 0.08) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
            maskImage: 'radial-gradient(ellipse 80% 70% at 80% 50%, #000 30%, transparent 90%)',
          }} />
          <div style={{
            position: 'absolute', top: '50%', right: 36, transform: 'translateY(-50%)',
            fontSize: 120, opacity: 0.18, color: 'oklch(0.15 0.05 45)', fontWeight: 500, lineHeight: 1,
          }}>€</div>
          <div style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.7, fontWeight: 500 }}>
            Subvenciones compatibles con tu empresa
          </div>
          <div style={{ fontSize: 56, fontWeight: 500, letterSpacing: '-0.035em', lineHeight: 1, marginTop: 8, fontFamily: 'var(--font-geist-mono), monospace' }}>
            {matches.length > 0 ? formatCurrency(totalPotential) : '—'}
          </div>
          <div style={{ fontSize: 14, opacity: 0.78, marginTop: 10, display: 'flex', gap: 18, alignItems: 'center' }}>
            <span><b style={{ fontWeight: 600 }}>{matches.length}</b> convocatorias compatibles</span>
            <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'currentColor', opacity: 0.5, display: 'inline-block' }} />
            <span><b style={{ fontWeight: 600 }}>{highFit.length}</b> de alta afinidad</span>
          </div>
          <div style={{ position: 'relative', display: 'flex', gap: 8, marginTop: 24 }}>
            <Link href="/dashboard/subvenciones" style={{
              background: 'oklch(0.22 0.05 45)', color: 'oklch(0.98 0.02 80)',
              border: 'none', padding: '10px 18px', borderRadius: 10,
              fontSize: 13.5, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 8,
              textDecoration: 'none',
            }}>
              Ver oportunidades
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14"/><path d="m13 5 7 7-7 7"/></svg>
            </Link>
            <button style={{
              background: 'oklch(0.99 0.02 70 / 0.85)', color: 'oklch(0.22 0.08 45)',
              border: 'none', padding: '10px 18px', borderRadius: 10,
              fontSize: 13.5, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 8,
              cursor: 'pointer',
            }}>
              Explicar con IA
            </button>
          </div>
        </div>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
          {/* Compatibles */}
          <div style={{ background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 12, padding: '18px 18px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--fg-3)', fontWeight: 500 }}>Compatibles</span>
              <span style={{ width: 26, height: 26, borderRadius: 7, background: 'var(--bg-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--fg-2)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
              </span>
            </div>
            <div style={{ fontSize: 30, fontWeight: 500, letterSpacing: '-0.025em', marginTop: 10, lineHeight: 1, fontFamily: 'var(--font-geist-mono), monospace' }}>{matches.length}</div>
            <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 6 }}>Convocatorias elegibles</div>
            <svg style={{ height: 28, marginTop: 10, width: '100%' }} viewBox="0 0 200 32" preserveAspectRatio="none">
              <polyline fill="none" stroke="var(--accent)" strokeWidth="1.5" points="0,26 20,24 40,22 60,18 80,16 100,14 120,10 140,12 160,8 180,6 200,4"/>
              <polyline fill="var(--accent-soft)" stroke="none" points="0,26 20,24 40,22 60,18 80,16 100,14 120,10 140,12 160,8 180,6 200,4 200,32 0,32"/>
            </svg>
          </div>

          {/* Solicitado */}
          <div style={{ background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 12, padding: '18px 18px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--fg-3)', fontWeight: 500 }}>Solicitado</span>
              <span style={{ width: 26, height: 26, borderRadius: 7, background: 'var(--bg-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--fg-2)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
              </span>
            </div>
            <div style={{ fontSize: 30, fontWeight: 500, letterSpacing: '-0.025em', marginTop: 10, lineHeight: 1, fontFamily: 'var(--font-geist-mono), monospace' }}>
              {totalRequested > 0 ? formatCurrency(totalRequested) : '0 €'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 6 }}>{applications.length} expediente{applications.length !== 1 ? 's' : ''}</div>
            <div style={{ display: 'flex', gap: 2, marginTop: 14, height: 6, borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ flex: Math.max(applications.length, 1), background: 'var(--accent)' }} />
              <div style={{ flex: Math.max(50 - applications.length, 0), background: 'var(--bg-3)' }} />
            </div>
          </div>

          {/* Concedido */}
          <div style={{ background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 12, padding: '18px 18px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--fg-3)', fontWeight: 500 }}>Concedido</span>
              <span style={{ width: 26, height: 26, borderRadius: 7, background: 'var(--bg-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--fg-2)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><path d="m5 12 4.5 4.5L20 6"/></svg>
              </span>
            </div>
            <div style={{ fontSize: 30, fontWeight: 500, letterSpacing: '-0.025em', marginTop: 10, lineHeight: 1, fontFamily: 'var(--font-geist-mono), monospace' }}>
              {formatCurrency(totalApproved)}
            </div>
            <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 6 }}>Fondos aprobados</div>
            <div style={{ marginTop: 14, fontSize: 11, color: 'var(--fg-3)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {totalApproved === 0 ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '2px 8px', borderRadius: 999, background: 'var(--info-soft)', color: 'oklch(0.35 0.1 245)', fontFamily: 'var(--font-geist-mono), monospace' }}>
                  En evaluación
                </span>
              ) : (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '2px 8px', borderRadius: 999, background: 'var(--good-soft)', color: 'oklch(0.35 0.12 150)', fontFamily: 'var(--font-geist-mono), monospace' }}>
                  Aprobado
                </span>
              )}
            </div>
          </div>

          {/* Activos */}
          <div style={{ background: 'var(--accent-soft)', border: '1px solid var(--accent-soft-2)', borderRadius: 12, padding: '18px 18px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--accent-ink)', fontWeight: 500 }}>Activos</span>
              <span style={{ width: 26, height: 26, borderRadius: 7, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-ink)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><path d="M3 17l6-6 4 4 8-8"/><path d="M21 7h-5M21 7v5"/></svg>
              </span>
            </div>
            <div style={{ fontSize: 30, fontWeight: 500, letterSpacing: '-0.025em', marginTop: 10, lineHeight: 1, fontFamily: 'var(--font-geist-mono), monospace', color: 'var(--accent-ink)' }}>{activeApps}</div>
            <div style={{ fontSize: 12, color: 'var(--accent-ink)', opacity: 0.7, marginTop: 6 }}>Expediente{activeApps !== 1 ? 's' : ''} en curso</div>
            {highFit[0] && (
              <div style={{ marginTop: 14, fontSize: 11, color: 'var(--accent-ink)', fontFamily: 'var(--font-geist-mono), monospace', opacity: 0.8 }}>
                → {highFit[0].grant?.title?.split(' ').slice(0, 3).join(' ')}…
              </div>
            )}
          </div>
        </div>

        {/* Pipeline */}
        <div style={{ background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 12, marginBottom: 16, padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 500 }}>Embudo de oportunidades</h3>
            <span style={{ fontSize: 11, color: 'var(--fg-3)', fontFamily: 'var(--font-geist-mono), monospace' }}>
              {matches.length} convocatorias · {formatCurrency(totalPotential)} potencial
            </span>
          </div>
          <div style={{ display: 'flex', height: 10, background: 'var(--bg-3)', borderRadius: 6, overflow: 'hidden', margin: '12px 0 14px' }}>
            {highFit.length > 0 && <div style={{ width: `${(highFit.length / Math.max(matches.length, 1)) * 100}%`, background: 'var(--accent)' }} />}
            {medFit.length > 0 && <div style={{ width: `${(medFit.length / Math.max(matches.length, 1)) * 100}%`, background: 'oklch(0.82 0.11 55)' }} />}
            {eligible.length > 0 && <div style={{ width: `${(eligible.length / Math.max(matches.length, 1)) * 100}%`, background: 'oklch(0.88 0.07 55)' }} />}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {[
              { color: 'var(--accent)', label: 'Alta afinidad', value: highFit.length },
              { color: 'oklch(0.82 0.11 55)', label: 'Media afinidad', value: medFit.length },
              { color: 'oklch(0.88 0.07 55)', label: 'Elegibles', value: eligible.length },
              { color: 'var(--bg-3)', label: 'Por explorar', value: Math.max(0, matches.length - highFit.length - medFit.length - eligible.length) },
            ].map(({ color, label, value }) => (
              <div key={label}>
                <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, marginRight: 6, background: color }} />
                <span style={{ fontSize: 11, color: 'var(--fg-3)' }}>{label}</span>
                <div style={{ fontSize: 17, fontWeight: 500, marginTop: 2, fontFamily: 'var(--font-geist-mono), monospace', letterSpacing: '-0.01em' }}>{value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Grid: urgent + side */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 16 }}>
          {/* Urgent */}
          <div style={{ background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px', borderBottom: '1px solid var(--line)' }}>
              <h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--accent)" stroke="none"><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z"/></svg>
                Acción urgente
              </h3>
              <Link href="/dashboard/subvenciones" style={{ fontSize: 12.5, color: 'var(--fg-3)', textDecoration: 'none' }}>Ver todas →</Link>
            </div>
            {urgentMatches.length > 0 ? urgentMatches.map((match, i) => {
              const grant = match.grant
              const days = daysUntil(grant?.deadline)
              const isUrgent = days !== null && days <= 7
              return (
                <div key={match.id} style={{
                  display: 'grid', gridTemplateColumns: '24px 1fr auto auto',
                  alignItems: 'center', gap: 14, padding: '14px 18px',
                  borderBottom: i < urgentMatches.length - 1 ? '1px solid var(--line)' : 'none',
                }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: 6,
                    background: 'var(--accent-soft)', color: 'var(--accent-ink)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 600,
                  }}>0{i + 1}</div>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 500 }}>
                      {grant?.title}
                      {' '}<span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '2px 8px', borderRadius: 999, background: 'var(--good-soft)', color: 'oklch(0.35 0.12 150)', fontFamily: 'var(--font-geist-mono), monospace' }}>Compatible</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.03em', marginTop: 3 }}>
                      {grant?.organismo}
                    </div>
                  </div>
                  <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end', fontSize: 11, color: 'var(--fg-3)' }}>
                    <span style={{ fontFamily: 'var(--font-geist-mono), monospace', fontSize: 13, color: 'var(--fg)', fontWeight: 500 }}>
                      {grant?.deadline ? new Date(grant.deadline).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : '—'}
                    </span>
                    <span style={{ color: isUrgent ? 'var(--danger)' : 'var(--fg-3)', fontWeight: 500 }}>
                      {days !== null ? `cierra en ${days} días` : ''}
                    </span>
                  </div>
                  <Link href={`/dashboard/subvenciones/${grant?.id}`} style={{
                    padding: '6px 12px', border: '1px solid var(--line-2)', borderRadius: 7,
                    fontSize: 12.5, background: 'var(--bg)', display: 'inline-flex', alignItems: 'center', gap: 6,
                    textDecoration: 'none', color: 'var(--fg)',
                  }}>
                    Ver
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14"/><path d="m13 5 7 7-7 7"/></svg>
                  </Link>
                </div>
              )
            }) : (
              <div style={{ padding: '28px 16px', textAlign: 'center', color: 'var(--fg-3)', fontSize: 12.5 }}>
                <div style={{ width: 40, height: 40, margin: '0 auto 10px', borderRadius: '50%', background: 'var(--bg-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--fg-3)' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m5 12 4.5 4.5L20 6"/></svg>
                </div>
                No hay convocatorias urgentes ahora mismo
              </div>
            )}
          </div>

          {/* Side column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* AI card */}
            <div style={{
              background: 'linear-gradient(180deg, var(--accent-soft) 0%, var(--bg) 100%)',
              border: '1px solid var(--accent-soft-2)', borderRadius: 12, padding: 20,
            }}>
              <h4 style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--accent)" stroke="none"><path d="M12 2 L13.5 8.5 L20 10 L13.5 11.5 L12 18 L10.5 11.5 L4 10 L10.5 8.5 Z"/></svg>
                Pregunta a Lead·AI
              </h4>
              <p style={{ margin: '0 0 14px', fontSize: 12.5, color: 'var(--fg-2)', lineHeight: 1.5 }}>
                Resuelve dudas sobre convocatorias, bases o tu expediente. Respuestas en segundos.
              </p>
              <div style={{
                background: 'var(--bg)', border: '1px solid var(--line-2)', borderRadius: 8,
                display: 'flex', alignItems: 'center', padding: '4px 4px 4px 12px', gap: 8,
              }}>
                <input
                  placeholder="¿Puedo acumular Kit Digital con NEOTEC?"
                  style={{
                    flex: 1, border: 'none', background: 'transparent', outline: 'none',
                    padding: '8px 0', fontFamily: 'inherit', fontSize: 13, color: 'var(--fg)',
                  }}
                />
                <button style={{
                  width: 28, height: 28, background: 'var(--accent)', color: 'var(--accent-ink)',
                  border: 'none', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14"/><path d="m13 5 7 7-7 7"/></svg>
                </button>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                {['Documentos necesarios', 'Puntos del baremo', 'Plazos 2026'].map(chip => (
                  <span key={chip} style={{ fontSize: 11, padding: '3px 8px', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 999, color: 'var(--fg-2)', cursor: 'pointer' }}>
                    {chip}
                  </span>
                ))}
              </div>
            </div>

            {/* Alerts */}
            <div style={{ background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 18 }}>
                <h4 style={{ fontSize: 13.5, fontWeight: 500, margin: 0, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--warn)" strokeWidth="1.75"><path d="M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.7 3.86a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/></svg>
                  Alertas
                </h4>
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: 'var(--bg-3)', color: 'var(--fg-2)', fontFamily: 'var(--font-geist-mono), monospace' }}>{alerts.length}</span>
              </div>
              {alerts.length > 0 ? alerts.slice(0, 3).map(alert => (
                <div key={alert.id} style={{ padding: '10px 18px', borderTop: '1px solid var(--line)', fontSize: 12.5 }}>
                  <div style={{ fontWeight: 500, color: 'var(--fg)' }}>{alert.title}</div>
                  {alert.message && <div style={{ color: 'var(--fg-3)', marginTop: 2, fontSize: 12 }}>{alert.message}</div>}
                </div>
              )) : (
                <div style={{ padding: '28px 16px', textAlign: 'center', color: 'var(--fg-3)', fontSize: 12.5 }}>
                  <div style={{ width: 40, height: 40, margin: '0 auto 10px', borderRadius: '50%', background: 'var(--bg-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m5 12 4.5 4.5L20 6"/></svg>
                  </div>
                  Sin alertas pendientes.<br />Todo tranquilo.
                </div>
              )}
            </div>

            {/* Tasks */}
            <div style={{ background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 18 }}>
                <h4 style={{ fontSize: 13.5, fontWeight: 500, margin: 0, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9 2h6"/></svg>
                  Tareas pendientes
                </h4>
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: 'var(--bg-3)', color: 'var(--fg-2)', fontFamily: 'var(--font-geist-mono), monospace' }}>{tasks.length}</span>
              </div>
              {tasks.length > 0 ? tasks.slice(0, 3).map(task => (
                <div key={task.id} style={{ padding: '10px 18px', borderTop: '1px solid var(--line)', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ width: 14, height: 14, borderRadius: 3, border: '2px solid var(--line-2)', flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 500 }}>{task.title}</div>
                    {task.due_date && (
                      <div style={{ fontSize: 11, color: daysUntil(task.due_date) !== null && (daysUntil(task.due_date) ?? 999) <= 7 ? 'var(--danger)' : 'var(--fg-3)', marginTop: 2 }}>
                        {formatDate(task.due_date)}
                      </div>
                    )}
                  </div>
                </div>
              )) : (
                <div style={{ padding: '28px 16px', textAlign: 'center', color: 'var(--fg-3)', fontSize: 12.5 }}>
                  <div style={{ width: 40, height: 40, margin: '0 auto 10px', borderRadius: '50%', background: 'var(--bg-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m5 12 4.5 4.5L20 6"/></svg>
                  </div>
                  Sin tareas pendientes.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Expedientes recientes */}
        {applications.length > 0 && (
          <div style={{ background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px', borderBottom: '1px solid var(--line)' }}>
              <h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 500 }}>Expedientes recientes</h3>
              <Link href="/dashboard/expedientes" style={{ fontSize: 12.5, color: 'var(--fg-3)', textDecoration: 'none' }}>Ver todos →</Link>
            </div>
            {applications.slice(0, 4).map((app, i) => {
              const { label, color } = statusLabel(app.status)
              const grant = app.grant as { title?: string; deadline?: string } | null
              return (
                <div key={app.id} style={{
                  display: 'grid', gridTemplateColumns: '1fr auto auto auto',
                  alignItems: 'center', gap: 20, padding: '14px 18px',
                  borderBottom: i < Math.min(applications.length, 4) - 1 ? '1px solid var(--line)' : 'none',
                }}>
                  <div>
                    <div style={{ fontSize: 13.5, fontWeight: 500 }}>{grant?.title || 'Subvención sin título'}</div>
                    <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 3, fontFamily: 'var(--font-geist-mono), monospace' }}>
                      {app.reference_number && `${app.reference_number} · `}Solicitado {formatDate(app.created_at)}
                    </div>
                  </div>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '2px 8px', borderRadius: 999, fontFamily: 'var(--font-geist-mono), monospace' }} className={color}>
                    {label}
                  </span>
                  {app.requested_amount && (
                    <span style={{ fontFamily: 'var(--font-geist-mono), monospace', fontSize: 14, fontWeight: 500 }}>
                      {formatCurrency(app.requested_amount)}
                    </span>
                  )}
                  <Link href={`/dashboard/expedientes/${app.id}`} style={{ color: 'var(--fg-3)', display: 'flex' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><path d="M5 12h14"/><path d="m13 5 7 7-7 7"/></svg>
                  </Link>
                </div>
              )
            })}
          </div>
        )}

        {/* Recomendaciones */}
        {topRecs.length > 0 && (
          <div style={{ background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px', borderBottom: '1px solid var(--line)' }}>
              <h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--accent)" stroke="none"><path d="M12 2 L13.5 8.5 L20 10 L13.5 11.5 L12 18 L10.5 11.5 L4 10 L10.5 8.5 Z"/></svg>
                Recomendadas para ti
              </h3>
              <Link href="/dashboard/subvenciones" style={{ fontSize: 12.5, color: 'var(--fg-3)', textDecoration: 'none' }}>Ver las {matches.length} →</Link>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, padding: 16 }}>
              {topRecs.map(match => {
                const grant = match.grant
                return (
                  <Link key={match.id} href={`/dashboard/subvenciones/${grant?.id}`} style={{
                    border: '1px solid var(--line)', background: 'var(--bg)', borderRadius: 10, padding: 16,
                    display: 'flex', flexDirection: 'column', gap: 8, cursor: 'pointer',
                    textDecoration: 'none', color: 'inherit',
                    transition: 'all .12s ease',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '2px 8px', borderRadius: 999, background: 'var(--accent-soft)', color: 'var(--accent-ink)', fontFamily: 'var(--font-geist-mono), monospace' }}>
                        Alta afinidad
                      </span>
                      <span style={{ fontFamily: 'var(--font-geist-mono), monospace', fontSize: 12, color: 'var(--accent)', fontWeight: 500 }}>
                        {match.eligibility_score}% match
                      </span>
                    </div>
                    <div style={{ fontSize: 13.5, fontWeight: 500, lineHeight: 1.25, marginTop: 4 }}>{grant?.title}</div>
                    {grant?.summary && (
                      <div style={{ color: 'var(--fg-3)', fontSize: 12, lineHeight: 1.45 }}>
                        {grant.summary.slice(0, 100)}{grant.summary.length > 100 ? '…' : ''}
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: 8, borderTop: '1px solid var(--line)' }}>
                      <span style={{ fontFamily: 'var(--font-geist-mono), monospace', fontSize: 13, fontWeight: 500 }}>
                        {match.potential_amount ? `hasta ${formatCurrency(match.potential_amount)}` : grant?.budget_per_company_max ? `hasta ${formatCurrency(grant.budget_per_company_max)}` : '—'}
                      </span>
                      <span style={{ fontSize: 11.5, color: 'var(--accent)', fontWeight: 500 }}>Preparar expediente →</span>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
