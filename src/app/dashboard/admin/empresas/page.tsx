import { createAdminClient } from '@/lib/supabase/admin'
import Header from '@/components/dashboard/header'
import { AdminNav } from '@/components/admin/admin-nav'
import { EmpresasTable } from './_table'

export default async function EmpresasAdminPage() {
  const admin = createAdminClient()

  const { data: companies } = await admin
    .from('companies')
    .select('id, name, cif, cnae_primary, region, employees_count, revenue_annual, is_startup, has_rd, created_at')
    .order('created_at', { ascending: false })

  const companyIds = (companies ?? []).map(c => c.id)

  // Get match counts per company
  const matchCounts: Record<string, { total: number; high: number }> = {}
  if (companyIds.length > 0) {
    const { data: matches } = await admin
      .from('company_grant_matches')
      .select('company_id, eligibility_score')
      .in('company_id', companyIds)
      .gte('eligibility_score', 40)

    for (const m of matches ?? []) {
      if (!matchCounts[m.company_id]) matchCounts[m.company_id] = { total: 0, high: 0 }
      matchCounts[m.company_id].total++
      if (m.eligibility_score >= 70) matchCounts[m.company_id].high++
    }
  }

  const rows = (companies ?? []).map(c => ({
    ...c,
    matchTotal: matchCounts[c.id]?.total ?? 0,
    matchHigh: matchCounts[c.id]?.high ?? 0,
  }))

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Header title="Admin · Empresas" subtitle={`${rows.length} empresas registradas`} />
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px 48px' }}>
        <AdminNav />
        <EmpresasTable rows={rows} />
      </div>
    </div>
  )
}
