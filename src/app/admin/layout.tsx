import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { AdminDock } from '@/components/admin/admin-dock'

export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: record } = await admin
    .from('users')
    .select('is_superadmin, role')
    .eq('id', user.id)
    .single()

  const canAccess = record?.is_superadmin || record?.role === 'admin'
  if (!canAccess) redirect('/dashboard')

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <div style={{ paddingBottom: 96 }}>
        {children}
      </div>
      <AdminDock showBackToDashboard={record?.is_superadmin ?? false} />
    </div>
  )
}
