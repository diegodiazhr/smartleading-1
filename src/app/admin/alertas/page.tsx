import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminDerivedAlerts } from '@/lib/admin-alerts'
import Header from '@/components/dashboard/header'
import { AdminEmptyState, AdminPill, AdminSectionCard, AdminStatCard } from '@/components/admin/admin-ui'
import { formatDate } from '@/lib/utils'

export default async function AdminAlertasPage() {
  const admin = createAdminClient()
  const alerts = await getAdminDerivedAlerts()
  const [{ data: errorLogs }, { data: closingSoon }] = await Promise.all([
    admin
      .from('admin_audit_logs')
      .select('id, action, target_label, created_at, metadata')
      .eq('status', 'error')
      .order('created_at', { ascending: false })
      .limit(6),
    admin
      .from('grants')
      .select('id, title, deadline, organismo')
      .eq('status', 'abierta')
      .not('deadline', 'is', null)
      .order('deadline', { ascending: true })
      .limit(6),
  ])

  const dangerCount = alerts.filter(alert => alert.level === 'danger').length
  const warnCount = alerts.filter(alert => alert.level === 'warn').length

  return (
    <div>
      <Header title="Admin · Alertas" subtitle="Incidencias, riesgos y prioridades operativas" />
      <div style={{ padding: '24px 28px 48px', display: 'grid', gap: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <AdminStatCard label="Alertas activas" value={alerts.length} sub="Señales del sistema y de datos" />
          <AdminStatCard label="Críticas" value={dangerCount} sub="Requieren atención prioritaria" color="var(--danger)" />
          <AdminStatCard label="Avisos" value={warnCount} sub="Conviene revisarlas hoy" color="var(--accent-ink)" />
          <AdminStatCard label="Errores recientes" value={errorLogs?.length ?? 0} sub="Últimas operaciones fallidas" />
        </div>

        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'minmax(0, 1.15fr) minmax(320px, 0.85fr)' }}>
          <AdminSectionCard title="Alertas del panel" subtitle="Estado actual del sistema y del dato">
            {alerts.length > 0 ? (
              <div style={{ display: 'grid', gap: 10 }}>
                {alerts.map(alert => (
                  <Link
                    key={alert.id}
                    href={alert.href}
                    style={{
                      padding: '14px 16px',
                      borderRadius: 12,
                      background: 'var(--bg)',
                      border: '1px solid var(--line)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 14,
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 5 }}>
                        <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--fg)' }}>{alert.title}</span>
                        <AdminPill tone={alert.level}>{alert.metric}</AdminPill>
                      </div>
                      <div style={{ fontSize: 12.5, color: 'var(--fg-4)', lineHeight: 1.5 }}>{alert.description}</div>
                    </div>
                    <span style={{ fontSize: 12.5, color: 'var(--accent-ink)', fontWeight: 500 }}>Abrir</span>
                  </Link>
                ))}
              </div>
            ) : (
              <AdminEmptyState>No hay alertas activas en este momento.</AdminEmptyState>
            )}
          </AdminSectionCard>

          <div style={{ display: 'grid', gap: 16 }}>
            <AdminSectionCard title="Operaciones con error" subtitle="Últimos fallos registrados">
              {errorLogs && errorLogs.length > 0 ? (
                <div style={{ display: 'grid', gap: 10 }}>
                  {errorLogs.map(log => (
                    <div key={log.id} style={{ padding: '12px 14px', borderRadius: 12, border: '1px solid var(--line)', background: 'var(--bg)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', marginBottom: 6 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg)' }}>{log.target_label ?? log.action}</div>
                        <AdminPill tone="danger">error</AdminPill>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--fg-4)' }}>{formatDate(log.created_at)}</div>
                      {log.metadata && (
                        <div style={{ marginTop: 8, fontSize: 11.5, color: 'var(--fg-3)', lineHeight: 1.5 }}>
                          {Object.entries(log.metadata).slice(0, 2).map(([key, value]) => `${key}: ${String(value)}`).join(' · ')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <AdminEmptyState>No hay fallos recientes.</AdminEmptyState>
              )}
            </AdminSectionCard>

            <AdminSectionCard title="Cierres próximos" subtitle="Convocatorias abiertas que vencen antes">
              {closingSoon && closingSoon.length > 0 ? (
                <div style={{ display: 'grid', gap: 10 }}>
                  {closingSoon.map(grant => (
                    <div key={grant.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg)' }}>{grant.title}</div>
                        <div style={{ fontSize: 12, color: 'var(--fg-4)', marginTop: 3 }}>{grant.organismo ?? 'Organismo no indicado'}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <AdminPill tone="warn">{formatDate(grant.deadline)}</AdminPill>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <AdminEmptyState>No hay cierres próximos.</AdminEmptyState>
              )}
            </AdminSectionCard>
          </div>
        </div>
      </div>
    </div>
  )
}
