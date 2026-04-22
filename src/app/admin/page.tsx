import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { getBdnsSyncStatus } from '@/lib/bdns-sync'
import Header from '@/components/dashboard/header'
import { getAdminDerivedAlerts } from '@/lib/admin-alerts'
import { formatDate } from '@/lib/utils'
import { AdminPill, AdminSectionCard, AdminStatCard, AdminEmptyState } from '@/components/admin/admin-ui'

function daysAgo(days: number) {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date.toISOString()
}

function activityLabel(action: string) {
  const map: Record<string, string> = {
    sync_bdns: 'Sincronización BDNS',
    run_matching_all: 'Matching global',
    run_matching_company: 'Matching individual',
    enrich_grants: 'Enriquecimiento IA',
    import_grants: 'Importación manual',
    update_user: 'Actualización de usuario',
  }
  return map[action] ?? action
}

export default async function AdminOverviewPage() {
  const admin = createAdminClient()
  const last7d = daysAgo(7)

  const [
    syncStatus,
    derivedAlerts,
    { count: totalGrants },
    { count: openGrants },
    { count: totalCompanies },
    { count: totalUsers },
    { count: totalMatches },
    { count: highFitMatches },
    { count: grantsLast7d },
    { count: companiesLast7d },
    { count: usersLast7d },
    { count: pendingEnrichment },
    { count: inactiveUsers },
    { data: companies },
    { data: grants },
    { data: matches },
    { data: recentLogs },
  ] = await Promise.all([
    getBdnsSyncStatus(),
    getAdminDerivedAlerts(),
    admin.from('grants').select('*', { count: 'exact', head: true }),
    admin.from('grants').select('*', { count: 'exact', head: true }).eq('status', 'abierta'),
    admin.from('companies').select('*', { count: 'exact', head: true }),
    admin.from('users').select('*', { count: 'exact', head: true }),
    admin.from('company_grant_matches').select('*', { count: 'exact', head: true }).gte('eligibility_score', 40),
    admin.from('company_grant_matches').select('*', { count: 'exact', head: true }).gte('eligibility_score', 70),
    admin.from('grants').select('*', { count: 'exact', head: true }).gte('created_at', last7d),
    admin.from('companies').select('*', { count: 'exact', head: true }).gte('created_at', last7d),
    admin.from('users').select('*', { count: 'exact', head: true }).gte('created_at', last7d),
    admin.from('grants').select('*', { count: 'exact', head: true }).in('status', ['abierta', 'proxima']).or('summary.is.null,summary.eq.'),
    admin.from('users').select('*', { count: 'exact', head: true }).eq('is_active', false),
    admin.from('companies').select('id, name, region, is_startup, has_rd'),
    admin.from('grants').select('id, title, deadline, status'),
    admin.from('company_grant_matches').select('company_id, grant_id, eligibility_score, last_calculated').gte('eligibility_score', 40),
    admin.from('admin_audit_logs').select('id, action, status, target_label, actor_user_id, created_at, metadata').order('created_at', { ascending: false }).limit(8),
  ])

  const lastSync = syncStatus.lastSyncAt
    ? new Date(syncStatus.lastSyncAt).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })
    : 'Nunca'

  const grantStatuses = ['abierta', 'proxima', 'cerrada', 'archivada'] as const
  const statusCounts = await Promise.all(
    grantStatuses.map(s =>
      admin.from('grants').select('*', { count: 'exact', head: true }).eq('status', s)
    )
  )

  const statusColors: Record<string, string> = {
    abierta: 'var(--good)',
    proxima: 'var(--accent)',
    cerrada: 'var(--fg-4)',
    archivada: 'var(--fg-4)',
  }

  const companyMap = new Map((companies ?? []).map(company => [company.id, company]))
  const grantMap = new Map((grants ?? []).map(grant => [grant.id, grant]))

  const companyStats = new Map<string, { total: number; high: number; lastCalculated: string | null }>()
  const grantStats = new Map<string, { total: number; high: number }>()

  for (const match of matches ?? []) {
    const companyStat = companyStats.get(match.company_id) ?? { total: 0, high: 0, lastCalculated: null }
    companyStat.total += 1
    if (match.eligibility_score >= 70) companyStat.high += 1
    if (!companyStat.lastCalculated || match.last_calculated > companyStat.lastCalculated) {
      companyStat.lastCalculated = match.last_calculated
    }
    companyStats.set(match.company_id, companyStat)

    const grantStat = grantStats.get(match.grant_id) ?? { total: 0, high: 0 }
    grantStat.total += 1
    if (match.eligibility_score >= 70) grantStat.high += 1
    grantStats.set(match.grant_id, grantStat)
  }

  const topCompanies = [...companyStats.entries()]
    .map(([companyId, stats]) => ({ company: companyMap.get(companyId), stats }))
    .filter((entry): entry is { company: NonNullable<typeof companies>[number]; stats: { total: number; high: number; lastCalculated: string | null } } => Boolean(entry.company))
    .sort((a, b) => b.stats.high - a.stats.high || b.stats.total - a.stats.total)
    .slice(0, 5)

  const topGrants = [...grantStats.entries()]
    .map(([grantId, stats]) => ({ grant: grantMap.get(grantId), stats }))
    .filter((entry): entry is { grant: NonNullable<typeof grants>[number]; stats: { total: number; high: number } } => Boolean(entry.grant))
    .sort((a, b) => b.stats.total - a.stats.total || b.stats.high - a.stats.high)
    .slice(0, 5)

  const actorIds = [...new Set((recentLogs ?? []).map(log => log.actor_user_id).filter(Boolean))]
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

  return (
    <div>
      <Header title="Admin" subtitle="Panel de administración SmartLeading" />
      <div style={{ padding: '24px 28px 48px' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: 12,
          marginBottom: 16,
        }}>
          <AdminStatCard label="Convocatorias" value={totalGrants ?? 0} sub={`${openGrants ?? 0} abiertas · +${grantsLast7d ?? 0} esta semana`} />
          <AdminStatCard label="Empresas" value={totalCompanies ?? 0} sub={`+${companiesLast7d ?? 0} esta semana`} />
          <AdminStatCard label="Usuarios" value={totalUsers ?? 0} sub={`${inactiveUsers ?? 0} inactivos · +${usersLast7d ?? 0} nuevos`} />
          <AdminStatCard label="Matches ≥40%" value={totalMatches ?? 0} sub={`${highFitMatches ?? 0} alta afinidad`} color="var(--good)" />
          <AdminStatCard label="Pendiente enrichment" value={pendingEnrichment ?? 0} sub="Convocatorias abiertas o próximas sin resumen" color="var(--accent-ink)" />
          <AdminStatCard label="Última sync BDNS" value={lastSync} sub={`${syncStatus.totalGrants} registros BDNS`} />
        </div>

        <div style={{
          display: 'grid',
          gap: 16,
          gridTemplateColumns: 'minmax(0, 1.25fr) minmax(320px, 0.75fr)',
          alignItems: 'start',
        }}>
          <div style={{ display: 'grid', gap: 16 }}>
            <AdminSectionCard title="Alertas operativas" subtitle="Prioridades inmediatas del panel" href="/admin/alertas">
              {derivedAlerts.length > 0 ? (
                <div style={{ display: 'grid', gap: 10 }}>
                  {derivedAlerts.slice(0, 4).map(alert => (
                    <Link
                      key={alert.id}
                      href={alert.href}
                      style={{
                        padding: '13px 14px',
                        borderRadius: 12,
                        background: 'var(--bg)',
                        border: '1px solid var(--line)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 16,
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg)' }}>{alert.title}</span>
                          <AdminPill tone={alert.level}>{alert.metric}</AdminPill>
                        </div>
                        <div style={{ fontSize: 12.5, color: 'var(--fg-4)' }}>{alert.description}</div>
                      </div>
                      <span style={{ color: 'var(--accent-ink)', fontSize: 12.5, fontWeight: 500 }}>Abrir</span>
                    </Link>
                  ))}
                </div>
              ) : (
                <AdminEmptyState>No hay alertas críticas ahora mismo.</AdminEmptyState>
              )}
            </AdminSectionCard>

            <AdminSectionCard title="Actividad reciente" subtitle="Operaciones y cambios registrados" href="/admin/auditoria">
              {recentLogs && recentLogs.length > 0 ? (
                <div style={{ display: 'grid', gap: 10 }}>
                  {recentLogs.map(log => {
                    const actor = log.actor_user_id ? actorMap[log.actor_user_id] : null
                    return (
                      <div
                        key={log.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 12,
                          padding: '12px 14px',
                          borderRadius: 12,
                          background: 'var(--bg)',
                          border: '1px solid var(--line)',
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
                            <span style={{ color: 'var(--fg)', fontSize: 13, fontWeight: 500 }}>{log.target_label ?? activityLabel(log.action)}</span>
                            <AdminPill tone={log.status === 'error' ? 'danger' : log.status === 'success' ? 'good' : 'neutral'}>
                              {log.status}
                            </AdminPill>
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--fg-4)' }}>
                            {actor?.full_name ?? actor?.email ?? 'Sistema'} · {formatDate(log.created_at)}
                          </div>
                        </div>
                        <span style={{ fontSize: 11.5, color: 'var(--fg-4)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          {activityLabel(log.action)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <AdminEmptyState>Aún no hay eventos de auditoría registrados.</AdminEmptyState>
              )}
            </AdminSectionCard>
          </div>

          <div style={{ display: 'grid', gap: 16 }}>
            <AdminSectionCard title="Convocatorias por estado">
              {grantStatuses.map((status, i) => {
                const count = statusCounts[i].count ?? 0
                const pct = totalGrants ? Math.round((count / totalGrants) * 100) : 0
                return (
                  <div key={status} style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
                      <span style={{ color: 'var(--fg-2)', textTransform: 'capitalize' }}>{status}</span>
                      <span style={{ color: 'var(--fg-4)', fontFamily: 'var(--font-geist-mono)' }}>{count}</span>
                    </div>
                    <div style={{ height: 4, background: 'var(--bg-3)', borderRadius: 99 }}>
                      <div style={{
                        height: '100%',
                        width: `${pct}%`,
                        background: statusColors[status],
                        borderRadius: 99,
                        transition: 'width .3s',
                      }} />
                    </div>
                  </div>
                )
              })}
            </AdminSectionCard>

            <AdminSectionCard title="Empresas con más afinidad" subtitle="Más oportunidades de alta calidad" href="/admin/empresas">
              {topCompanies.length > 0 ? (
                <div style={{ display: 'grid', gap: 10 }}>
                  {topCompanies.map(({ company, stats }) => (
                    <div key={company.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg)' }}>{company.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--fg-4)', marginTop: 3 }}>
                          {[company.region, company.is_startup ? 'Startup' : null, company.has_rd ? 'I+D' : null].filter(Boolean).join(' · ') || 'Sin etiquetas'}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--good)' }}>{stats.high} alta afinidad</div>
                        <div style={{ fontSize: 12, color: 'var(--fg-4)' }}>{stats.total} matches · {stats.lastCalculated ? formatDate(stats.lastCalculated) : '—'}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <AdminEmptyState>Todavía no hay enough matching calculado.</AdminEmptyState>
              )}
            </AdminSectionCard>

            <AdminSectionCard title="Convocatorias con mayor tracción" subtitle="Donde más encaja el portfolio actual" href="/admin/convocatorias">
              {topGrants.length > 0 ? (
                <div style={{ display: 'grid', gap: 10 }}>
                  {topGrants.map(({ grant, stats }) => (
                    <div key={grant.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg)' }}>{grant.title}</div>
                        <div style={{ fontSize: 12, color: 'var(--fg-4)', marginTop: 3 }}>
                          {grant.deadline ? `Cierra ${formatDate(grant.deadline)}` : 'Sin fecha de cierre'}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-ink)' }}>{stats.total} matches</div>
                        <div style={{ fontSize: 12, color: 'var(--fg-4)' }}>{stats.high} alta afinidad · {grant.status}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <AdminEmptyState>Aún no hay datos suficientes para priorizar convocatorias.</AdminEmptyState>
              )}
            </AdminSectionCard>
          </div>
        </div>
      </div>
    </div>
  )
}
