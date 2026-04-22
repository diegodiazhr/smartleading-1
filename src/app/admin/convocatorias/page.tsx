import { createAdminClient } from '@/lib/supabase/admin'
import Header from '@/components/dashboard/header'
import { ConvocatoriasTable } from './_table'
import { AdminStatCard } from '@/components/admin/admin-ui'

export default async function AdminConvocatoriasPage() {
  const admin = createAdminClient()

  const [
    { data: grants },
    { data: matches },
    { data: calls },
    { data: sourceRecords },
    { count: withoutSummary },
  ] = await Promise.all([
    admin
      .from('grants')
      .select('id, title, organismo, status, source, scope, deadline, summary, source_url, updated_at')
      .order('updated_at', { ascending: false })
      .limit(250),
    admin
      .from('company_grant_matches')
      .select('grant_id, eligibility_score')
      .gte('eligibility_score', 40),
    admin.from('grant_calls').select('grant_id'),
    admin.from('grant_source_records').select('grant_id'),
    admin.from('grants').select('*', { count: 'exact', head: true }).in('status', ['abierta', 'proxima']).or('summary.is.null,summary.eq.'),
  ])

  const matchCounts = new Map<string, number>()
  for (const match of matches ?? []) {
    matchCounts.set(match.grant_id, (matchCounts.get(match.grant_id) ?? 0) + 1)
  }

  const callCounts = new Map<string, number>()
  for (const call of calls ?? []) {
    if (!call.grant_id) continue
    callCounts.set(call.grant_id, (callCounts.get(call.grant_id) ?? 0) + 1)
  }

  const sourceRecordCounts = new Map<string, number>()
  for (const record of sourceRecords ?? []) {
    if (!record.grant_id) continue
    sourceRecordCounts.set(record.grant_id, (sourceRecordCounts.get(record.grant_id) ?? 0) + 1)
  }

  const rows = (grants ?? []).map(grant => ({
    ...grant,
    matchTotal: matchCounts.get(grant.id) ?? 0,
    callCount: callCounts.get(grant.id) ?? 0,
    sourceRecordCount: sourceRecordCounts.get(grant.id) ?? 0,
  }))

  return (
    <div>
      <Header title="Admin · Convocatorias" subtitle="Calidad, pipeline y tracción del catálogo" />
      <div style={{ padding: '24px 28px 48px', display: 'grid', gap: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <AdminStatCard label="Catálogo" value={rows.length} sub="Convocatorias recientes cargadas" />
          <AdminStatCard label="Sin resumen" value={withoutSummary ?? 0} sub="Abiertas o próximas" color="var(--accent-ink)" />
          <AdminStatCard label="Con pipeline" value={rows.filter(row => row.callCount > 0).length} sub="Persistidas en grant_calls" color="var(--good)" />
          <AdminStatCard label="Con tracción" value={rows.filter(row => row.matchTotal > 0).length} sub="Tienen al menos un match" />
        </div>
        <ConvocatoriasTable rows={rows} />
      </div>
    </div>
  )
}
