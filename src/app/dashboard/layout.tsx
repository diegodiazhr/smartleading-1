import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Sidebar from '@/components/dashboard/sidebar'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Check if user has a company profile; if not, redirect to onboarding
  const admin = createAdminClient()
  const { data: userRecord } = await admin
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!userRecord?.organization_id) {
    redirect('/onboarding')
  }

  const { data: company } = await admin
    .from('companies')
    .select('id')
    .eq('organization_id', userRecord.organization_id)
    .single()

  if (!company) {
    redirect('/onboarding')
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        {children}
      </main>
    </div>
  )
}
