import { createAdminClient } from '@/lib/supabase/admin'
import { getBdnsSyncStatus } from '@/lib/bdns-sync'
import Header from '@/components/dashboard/header'
import { AdminNav } from '@/components/admin/admin-nav'

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div style={{
      padding: '20px 24px',
      background: 'var(--bg)',
      border: '1px solid var(--line)',
      borderRadius: 12,
    }}>
      <div style={{ fontSize: 12, color: 'var(--fg-3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 600, color: color ?? 'var(--fg)', letterSpacing: '-0.02em' }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--fg-4)', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

export default async function AdminPage() {
  const admin = createAdminClient()

  const [
    syncStatus,
    { count: totalGrants },
    { count: openGrants },
    { count: totalCompanies },
    { count: totalUsers },
    { count: totalMatches },
    { count: highFitMatches },
  ] = await Promise.all([
    getBdnsSyncStatus(),
    admin.from('grants').select('*', { count: 'exact', head: true }),
    admin.from('grants').select('*', { count: 'exact', head: true }).eq('status', 'abierta'),
    admin.from('companies').select('*', { count: 'exact', head: true }),
    admin.from('users').select('*', { count: 'exact', head: true }),
    admin.from('company_grant_matches').select('*', { count: 'exact', head: true }).gte('eligibility_score', 40),
    admin.from('company_grant_matches').select('*', { count: 'exact', head: true }).gte('eligibility_score', 70),
  ])

  const lastSync = syncStatus.lastSyncAt
    ? new Date(syncStatus.lastSyncAt).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })
    : 'Nunca'

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Header title="Admin" subtitle="Panel de administración de SmartLeading" />
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px 48px' }}>
        <AdminNav />

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: 12,
          marginBottom: 32,
        }}>
          <StatCard label="Convocatorias" value={totalGrants ?? 0} sub={`${openGrants ?? 0} abiertas`} />
          <StatCard label="Empresas" value={totalCompanies ?? 0} />
          <StatCard label="Usuarios" value={totalUsers ?? 0} />
          <StatCard label="Matches ≥40%" value={totalMatches ?? 0} sub={`${highFitMatches ?? 0} de alta afinidad`} color="var(--good)" />
          <StatCard label="Última sync BDNS" value={lastSync} />
        </div>

        <div style={{
          padding: '20px 24px',
          background: 'var(--bg)',
          border: '1px solid var(--line)',
          borderRadius: 12,
          maxWidth: 480,
        }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg)', marginBottom: 12 }}>Distribución por estado</div>
          {(['abierta', 'proxima', 'cerrada', 'archivada'] as const).map(async (status) => {
            const { count } = await admin.from('grants').select('*', { count: 'exact', head: true }).eq('status', status)
            const pct = totalGrants ? Math.round(((count ?? 0) / totalGrants) * 100) : 0
            const colors: Record<string, string> = {
              abierta: 'var(--good)',
              proxima: 'var(--accent)',
              cerrada: 'var(--fg-4)',
              archivada: 'var(--fg-4)',
            }
            return (
              <div key={status} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span style={{ color: 'var(--fg-2)', textTransform: 'capitalize' }}>{status}</span>
                  <span style={{ color: 'var(--fg-3)', fontFamily: 'var(--font-geist-mono)' }}>{count ?? 0}</span>
                </div>
                <div style={{ height: 4, background: 'var(--bg-3)', borderRadius: 99 }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: colors[status], borderRadius: 99, transition: 'width .3s' }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
