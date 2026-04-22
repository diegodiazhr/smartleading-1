import { createAdminClient } from '@/lib/supabase/admin'
import Header from '@/components/dashboard/header'
import { EmpresasTable } from '@/app/dashboard/admin/empresas/_table'

export default async function AdminEmpresasPage() {
  const admin = createAdminClient()

  const { data: companies } = await admin
    .from('companies')
    .select('id, name, cif, cnae_primary, region, municipality, website, employees_count, revenue_annual, is_startup, has_rd, doc_score, created_at, updated_at')
    .order('created_at', { ascending: false })

  const companyIds = (companies ?? []).map(company => company.id)
  const matchCounts: Record<string, { total: number; high: number; lastCalculated: string | null }> = {}

  if (companyIds.length > 0) {
    const { data: matches } = await admin
      .from('company_grant_matches')
      .select('company_id, eligibility_score, last_calculated')
      .in('company_id', companyIds)
      .gte('eligibility_score', 40)

    for (const m of matches ?? []) {
      if (!matchCounts[m.company_id]) matchCounts[m.company_id] = { total: 0, high: 0, lastCalculated: null }
      const stats = matchCounts[m.company_id]
      stats.total++
      if (m.eligibility_score >= 70) stats.high++
      if (m.last_calculated && (!stats.lastCalculated || m.last_calculated > stats.lastCalculated)) {
        stats.lastCalculated = m.last_calculated
      }
    }
  }

  const rows = (companies ?? []).map(company => ({
    ...company,
    matchTotal: matchCounts[company.id]?.total ?? 0,
    matchHigh: matchCounts[company.id]?.high ?? 0,
    lastCalculated: matchCounts[company.id]?.lastCalculated ?? null,
  }))

  return (
    <div>
      <Header title="Admin · Empresas" subtitle={`${rows.length} empresas registradas`} />
      <div style={{ padding: '24px 28px 48px' }}>
        <EmpresasTable rows={rows} />
      </div>
    </div>
  )
}
