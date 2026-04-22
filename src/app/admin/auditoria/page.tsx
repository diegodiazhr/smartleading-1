import { createAdminClient } from '@/lib/supabase/admin'
import Header from '@/components/dashboard/header'
import { AdminPill, AdminSectionCard, AdminStatCard } from '@/components/admin/admin-ui'
import { formatDate } from '@/lib/utils'

function actionLabel(action: string) {
  const map: Record<string, string> = {
    sync_grant_sources: 'Sincronización fuentes oficiales',
    sync_bdns: 'Sincronización BDNS',
    run_matching_all: 'Matching global',
    run_matching_company: 'Matching por empresa',
    enrich_grants: 'Enriquecimiento IA',
    import_grants: 'Importación de convocatorias',
    update_user: 'Actualización de usuario',
  }
  return map[action] ?? action
}

export default async function AdminAuditoriaPage() {
  const admin = createAdminClient()

  const { data: logs } = await admin
    .from('admin_audit_logs')
    .select('id, actor_user_id, action, entity_type, entity_id, target_label, status, metadata, created_at')
    .order('created_at', { ascending: false })
    .limit(50)

  const actorIds = [...new Set((logs ?? []).map(log => log.actor_user_id).filter(Boolean))]
  const actorMap: Record<string, { full_name: string | null; email: string }> = {}

  if (actorIds.length > 0) {
    const { data: actors } = await admin
      .from('users')
      .select('id, full_name, email')
      .in('id', actorIds as string[])

    for (const actor of actors ?? []) {
      actorMap[actor.id] = { full_name: actor.full_name, email: actor.email }
    }
  }

  const successCount = (logs ?? []).filter(log => log.status === 'success').length
  const errorCount = (logs ?? []).filter(log => log.status === 'error').length

  return (
    <div>
      <Header title="Admin · Auditoría" subtitle="Rastro de cambios y operaciones administrativas" />
      <div style={{ padding: '24px 28px 48px', display: 'grid', gap: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <AdminStatCard label="Eventos" value={logs?.length ?? 0} sub="Últimos registros cargados" />
          <AdminStatCard label="Correctos" value={successCount} sub="Acciones completadas" color="var(--good)" />
          <AdminStatCard label="Errores" value={errorCount} sub="Acciones fallidas" color="var(--danger)" />
          <AdminStatCard label="Actores" value={actorIds.length} sub="Usuarios con actividad" />
        </div>

        <AdminSectionCard title="Timeline de auditoría" subtitle="Cambios recientes del panel">
          <div style={{ display: 'grid', gap: 10 }}>
            {(logs ?? []).map(log => {
              const actor = log.actor_user_id ? actorMap[log.actor_user_id] : null
              return (
                <div key={log.id} style={{ padding: '13px 14px', borderRadius: 12, border: '1px solid var(--line)', background: 'var(--bg)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg)' }}>
                        {log.target_label ?? actionLabel(log.action)}
                      </span>
                      <AdminPill tone={log.status === 'error' ? 'danger' : log.status === 'success' ? 'good' : 'neutral'}>
                        {log.status}
                      </AdminPill>
                      {log.entity_type && <AdminPill tone="neutral">{log.entity_type}</AdminPill>}
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--fg-4)' }}>{formatDate(log.created_at)}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--fg-4)' }}>
                    {actor?.full_name ?? actor?.email ?? 'Sistema'} · {actionLabel(log.action)}
                    {log.entity_id ? ` · ${log.entity_id}` : ''}
                  </div>
                  {log.metadata && Object.keys(log.metadata).length > 0 && (
                    <div style={{ marginTop: 8, fontSize: 11.5, color: 'var(--fg-3)', lineHeight: 1.55 }}>
                      {Object.entries(log.metadata).slice(0, 4).map(([key, value]) => `${key}: ${String(value)}`).join(' · ')}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </AdminSectionCard>
      </div>
    </div>
  )
}
