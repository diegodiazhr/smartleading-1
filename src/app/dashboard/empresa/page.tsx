import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Header from '@/components/dashboard/header'
import EmpresaProfile from '@/components/empresa/empresa-profile'
import type { Company } from '@/lib/types'

export default async function EmpresaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()
  const { data: userRecord } = await admin
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!userRecord?.organization_id) redirect('/onboarding')

  const { data: company } = await admin
    .from('companies')
    .select('*')
    .eq('organization_id', userRecord.organization_id)
    .single()

  if (!company) redirect('/onboarding')

  const { count: matchCount } = await admin
    .from('company_grant_matches')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', company.id)
    .gte('eligibility_score', 40)

  return (
    <div className="flex flex-col h-full overflow-auto">
      <Header title="Mi Empresa" subtitle="Perfil y configuración de tu empresa" />
      <div className="flex-1 p-6">
        <EmpresaProfile company={company as Company} matchCount={matchCount ?? 0} />
      </div>
    </div>
  )
}
