import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Sidebar from '@/components/dashboard/sidebar'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  let user = null
  try {
    const supabase = await createClient()
    const { data } = await supabase.auth.getUser()
    user = data.user
  } catch {
    redirect('/login')
  }

  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: userRecord } = await admin
    .from('users')
    .select('organization_id, role')
    .eq('id', user.id)
    .single()

  // Platform admin users can only access the admin panel
  if (userRecord?.role === 'admin' && !userRecord?.organization_id) redirect('/admin')

  if (!userRecord?.organization_id) redirect('/onboarding')

  const { data: company } = await admin
    .from('companies')
    .select('id, name, cif')
    .eq('organization_id', userRecord.organization_id)
    .maybeSingle()

  if (!company) redirect('/onboarding')

  const { data: userDetails } = await admin
    .from('users')
    .select('is_superadmin')
    .eq('id', user.id)
    .single()

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar
        companyName={company.name}
        companyCif={company.cif}
        isSuperAdmin={userDetails?.is_superadmin ?? false}
      />
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {children}
      </main>
    </div>
  )
}
