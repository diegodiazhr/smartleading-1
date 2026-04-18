import { createClient } from '@/lib/supabase/server'
import Header from '@/components/dashboard/header'
import GrantBrowser from '@/components/grants/grant-browser'

export default async function SubvencionesPage() {
  const supabase = await createClient()

  const { data: grants } = await supabase
    .from('grants')
    .select('*')
    .order('deadline', { ascending: true })

  return (
    <div className="flex flex-col h-full overflow-auto">
      <Header
        title="Subvenciones"
        subtitle="Explora todas las convocatorias activas"
      />
      <div className="flex-1 p-6">
        <GrantBrowser initialGrants={grants || []} />
      </div>
    </div>
  )
}
