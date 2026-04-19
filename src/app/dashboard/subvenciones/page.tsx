import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getBdnsSyncStatus } from '@/lib/bdns-sync'
import Header from '@/components/dashboard/header'
import GrantBrowser from '@/components/grants/grant-browser'
import BdnsSyncPanel from '@/components/grants/bdns-sync-panel'

export default async function SubvencionesPage() {
  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()

  const [syncStatus, matchesResult] = await Promise.all([
    getBdnsSyncStatus(),
    user
      ? admin.from('users').select('organization_id').eq('id', user.id).single()
      : Promise.resolve({ data: null }),
  ])

  let matchCount = 0

  if (matchesResult?.data?.organization_id) {
    const { data: company } = await admin
      .from('companies')
      .select('id')
      .eq('organization_id', matchesResult.data.organization_id)
      .single()

    if (company?.id) {
      const { count } = await admin
        .from('company_grant_matches')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', company.id)
        .gte('eligibility_score', 40)

      matchCount = count ?? 0
    }
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Header title="Subvenciones" subtitle="Explora todas las convocatorias activas" />
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px 48px' }}>
        <BdnsSyncPanel
          lastSyncAt={syncStatus.lastSyncAt}
          totalGrants={syncStatus.totalGrants}
        />
        <div style={{ marginTop: 16 }}>
          <GrantBrowser hasMatches={matchCount > 0} matchCount={matchCount} />
        </div>
      </div>
    </div>
  )
}
