import { createClient } from '@/lib/supabase/server'
import Header from '@/components/dashboard/header'
import ExpedientesList from '@/components/applications/expedientes-list'

export default async function ExpedientesPage() {
  const supabase = await createClient()

  const { data: applications } = await supabase
    .from('applications')
    .select('*, grant:grants(id, title, organismo, deadline, budget_per_company_max, grant_type)')
    .order('updated_at', { ascending: false })

  return (
    <div className="flex flex-col h-full overflow-auto">
      <Header title="Expedientes" subtitle="Gestiona todas tus solicitudes de subvención" />
      <div className="flex-1 p-6">
        <ExpedientesList applications={applications || []} />
      </div>
    </div>
  )
}
