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

  const [{ data: grants }, syncStatus, matchesResult] = await Promise.all([
    supabase
      .from('grants')
      .select('*')
      .order('deadline', { ascending: true })
      .limit(500),
    getBdnsSyncStatus(),
    user
      ? admin.from('users').select('organization_id').eq('id', user.id).single()
      : Promise.resolve({ data: null }),
  ])

  let matchMap: Record<string, { eligibility_score: number; potential_amount: number | null }> = {}

  if (matchesResult?.data?.organization_id) {
    const { data: company } = await admin
      .from('companies')
      .select('id')
      .eq('organization_id', matchesResult.data.organization_id)
      .single()

    if (company?.id) {
      const { data: matches } = await admin
        .from('company_grant_matches')
        .select('grant_id, eligibility_score, potential_amount')
        .eq('company_id', company.id)

      if (matches) {
        for (const m of matches) {
          matchMap[m.grant_id] = {
            eligibility_score: m.eligibility_score ?? 0,
            potential_amount: m.potential_amount ?? null,
          }
        }
      }
    }
  }

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
        <GrantBrowser initialGrants={grants ?? []} matchMap={matchMap} />
      </div>
    </div>
  )
}
