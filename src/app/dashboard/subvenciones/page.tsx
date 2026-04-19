import { createClient } from '@/lib/supabase/server'
import { getBdnsSyncStatus } from '@/lib/bdns-sync'
import Header from '@/components/dashboard/header'
import GrantBrowser from '@/components/grants/grant-browser'
import BdnsSyncPanel from '@/components/grants/bdns-sync-panel'

export default async function SubvencionesPage() {
  const supabase = await createClient()

  const [{ data: grants }, syncStatus] = await Promise.all([
    supabase
      .from('grants')
      .select('*')
      .in('status', ['abierta', 'proxima'])
      .order('deadline', { ascending: true })
      .limit(500),
    getBdnsSyncStatus(),
  ])

  return (
    <div className="flex flex-col h-full overflow-auto">
      <Header
        title="Subvenciones"
        subtitle="Explora todas las convocatorias activas"
      />
      <div className="flex-1 p-6 space-y-4">
        <BdnsSyncPanel
          lastSyncAt={syncStatus.lastSyncAt}
          totalGrants={syncStatus.totalGrants}
        />
        <GrantBrowser initialGrants={grants ?? []} />
      </div>
    </div>
  )
}
