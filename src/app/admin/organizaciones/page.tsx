import type { CSSProperties } from 'react'
import { createAdminClient } from '@/lib/supabase/admin'
import Header from '@/components/dashboard/header'
import { AdminPill, AdminSectionCard, AdminStatCard } from '@/components/admin/admin-ui'
import { formatDate } from '@/lib/utils'

export default async function AdminOrganizacionesPage() {
  const admin = createAdminClient()

  const [{ data: orgs }, { data: users }, { data: companies }, { data: applications }] = await Promise.all([
    admin.from('organizations').select('id, name, type, plan, created_at').order('created_at', { ascending: false }),
    admin.from('users').select('id, organization_id'),
    admin.from('companies').select('id, organization_id'),
    admin.from('applications').select('id, organization_id, status'),
  ])

  const userCounts = new Map<string, number>()
  const companyCounts = new Map<string, number>()
  const applicationCounts = new Map<string, number>()
  const activeApplicationCounts = new Map<string, number>()

  for (const user of users ?? []) {
    userCounts.set(user.organization_id, (userCounts.get(user.organization_id) ?? 0) + 1)
  }
  for (const company of companies ?? []) {
    companyCounts.set(company.organization_id, (companyCounts.get(company.organization_id) ?? 0) + 1)
  }
  for (const application of applications ?? []) {
    applicationCounts.set(application.organization_id, (applicationCounts.get(application.organization_id) ?? 0) + 1)
    if (!['closed', 'denied'].includes(application.status)) {
      activeApplicationCounts.set(application.organization_id, (activeApplicationCounts.get(application.organization_id) ?? 0) + 1)
    }
  }

  return (
    <div>
      <Header title="Admin · Organizaciones" subtitle="Base instalada, plan y actividad por cuenta" />
      <div style={{ padding: '24px 28px 48px', display: 'grid', gap: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <AdminStatCard label="Organizaciones" value={orgs?.length ?? 0} sub="Cuentas dadas de alta" />
          <AdminStatCard label="Enterprise" value={(orgs ?? []).filter(org => org.plan === 'enterprise').length} sub="Plan enterprise" color="var(--warn)" />
          <AdminStatCard label="Con empresas" value={[...companyCounts.values()].filter(count => count > 0).length} sub="Organizaciones con ficha empresarial" color="var(--good)" />
          <AdminStatCard label="Con expedientes" value={[...applicationCounts.values()].filter(count => count > 0).length} sub="Al menos un expediente" />
        </div>

        <AdminSectionCard title="Cartera de organizaciones" subtitle="Visión comercial y operativa">
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg)' }}>
                  <th style={thStyle}>Organización</th>
                  <th style={thStyle}>Tipo</th>
                  <th style={thStyle}>Plan</th>
                  <th style={thStyle}>Usuarios</th>
                  <th style={thStyle}>Empresas</th>
                  <th style={thStyle}>Expedientes</th>
                  <th style={thStyle}>Alta</th>
                </tr>
              </thead>
              <tbody>
                {(orgs ?? []).map(org => (
                  <tr key={org.id}>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 500, color: 'var(--fg)' }}>{org.name}</div>
                    </td>
                    <td style={tdStyle}>
                      <span style={{ textTransform: 'capitalize' }}>{org.type}</span>
                    </td>
                    <td style={tdStyle}>
                      <AdminPill tone={org.plan === 'enterprise' ? 'warn' : org.plan === 'scale' ? 'good' : org.plan === 'growth' ? 'info' : 'neutral'}>
                        {org.plan}
                      </AdminPill>
                    </td>
                    <td style={tdStyle}>{userCounts.get(org.id) ?? 0}</td>
                    <td style={tdStyle}>{companyCounts.get(org.id) ?? 0}</td>
                    <td style={tdStyle}>
                      <div>{applicationCounts.get(org.id) ?? 0} totales</div>
                      <div style={{ fontSize: 11.5, color: 'var(--fg-4)', marginTop: 3 }}>{activeApplicationCounts.get(org.id) ?? 0} activos</div>
                    </td>
                    <td style={tdStyle}>{formatDate(org.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AdminSectionCard>
      </div>
    </div>
  )
}

const thStyle: CSSProperties = {
  padding: '8px 12px',
  textAlign: 'left',
  fontSize: 11,
  color: 'var(--fg-4)',
  fontWeight: 500,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  borderBottom: '1px solid var(--line)',
}

const tdStyle: CSSProperties = {
  padding: '10px 12px',
  fontSize: 13,
  color: 'var(--fg-2)',
  borderBottom: '1px solid var(--line)',
  verticalAlign: 'middle',
}
