import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import Header from '@/components/dashboard/header'
import { UsuariosTable } from '@/app/dashboard/admin/usuarios/_table'

export default async function AdminUsuariosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const admin = createAdminClient()

  const { data: users } = await admin
    .from('users')
    .select('id, email, full_name, role, is_superadmin, is_active, created_at, updated_at, organization_id')
    .order('created_at', { ascending: false })

  const orgIds = [...new Set((users ?? []).map(u => u.organization_id).filter(Boolean))]
  const orgMap: Record<string, { name: string; plan: string }> = {}

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

  const currentUser = user
    ? (users ?? []).find(record => record.id === user.id)
    : null

  return (
    <div>
      <Header title="Admin · Usuarios" subtitle={`${rows.length} usuarios registrados`} />
      <div style={{ padding: '24px 28px 48px' }}>
        <UsuariosTable rows={rows} canManageRoles={Boolean(currentUser?.is_superadmin)} />
      </div>
    </div>
  )
}
