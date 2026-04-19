import { createAdminClient } from '@/lib/supabase/admin'
import Header from '@/components/dashboard/header'
import { AdminNav } from '@/components/admin/admin-nav'
import { UsuariosTable } from './_table'

export default async function UsuariosAdminPage() {
  const admin = createAdminClient()

  const { data: users } = await admin
    .from('users')
    .select('id, email, full_name, role, is_superadmin, is_active, created_at, organization_id')
    .order('created_at', { ascending: false })

  const orgIds = [...new Set((users ?? []).map(u => u.organization_id).filter(Boolean))]

  let orgMap: Record<string, { name: string; plan: string }> = {}
  if (orgIds.length > 0) {
    const { data: orgs } = await admin
      .from('organizations')
      .select('id, name, plan')
      .in('id', orgIds as string[])
    for (const o of orgs ?? []) {
      orgMap[o.id] = { name: o.name, plan: o.plan }
    }
  }

  const rows = (users ?? []).map(u => ({
    ...u,
    orgName: u.organization_id ? (orgMap[u.organization_id]?.name ?? '—') : '—',
    orgPlan: u.organization_id ? (orgMap[u.organization_id]?.plan ?? '—') : '—',
  }))

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Header title="Admin · Usuarios" subtitle={`${rows.length} usuarios registrados`} />
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px 48px' }}>
        <AdminNav />
        <UsuariosTable rows={rows} />
      </div>
    </div>
  )
}
