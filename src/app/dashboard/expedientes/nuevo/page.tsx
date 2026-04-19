import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Header from '@/components/dashboard/header'
import NuevoExpedienteForm from '@/components/applications/nuevo-expediente-form'

export default async function NuevoExpedientePage({
  searchParams,
}: {
  searchParams: Promise<{ grantId?: string }>
}) {
  const { grantId } = await searchParams
  if (!grantId) redirect('/dashboard/subvenciones')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient()

  const { data: grant } = await admin
    .from('grants')
    .select('id, title, organismo, deadline, budget_per_company_min, budget_per_company_max, grant_type, scope, summary, status')
    .eq('id', grantId)
    .single()

  if (!grant) redirect('/dashboard/subvenciones')

  // Check if already applied
  const { data: userRecord } = await admin
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  const { data: company } = userRecord?.organization_id
    ? await admin.from('companies').select('id').eq('organization_id', userRecord.organization_id).single()
    : { data: null }

  const { data: existing } = company
    ? await admin.from('applications').select('id').eq('company_id', company.id).eq('grant_id', grantId).maybeSingle()
    : { data: null }

  return (
    <div className="flex flex-col h-full overflow-auto">
      <Header
        title="Nueva solicitud"
        subtitle="Inicia un expediente de subvención"
      />
      <div className="flex-1 p-6">
        <NuevoExpedienteForm grant={grant as any} existingApplicationId={existing?.id ?? null} />
      </div>
    </div>
  )
}
