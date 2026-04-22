import { createAdminClient } from '@/lib/supabase/admin'
import Header from '@/components/dashboard/header'
import { OperacionesPanel } from '@/app/dashboard/admin/operaciones/_panel'

export default async function AdminOperacionesPage() {
  const admin = createAdminClient()
  const { data: history } = await admin
    .from('admin_audit_logs')
    .select('id, action, status, target_label, created_at, metadata')
    .in('action', ['sync_grant_sources', 'sync_bdns', 'run_matching_all', 'enrich_grants'])
    .order('created_at', { ascending: false })
    .limit(12)

  return (
    <div>
      <Header title="Admin · Operaciones" subtitle="Sincronización, matching y enriquecimiento de datos" />
      <div style={{ padding: '24px 28px 48px' }}>
        <OperacionesPanel history={(history ?? []) as Array<{
          id: string
          action: string
          status: 'info' | 'success' | 'error'
          target_label: string | null
          created_at: string
          metadata: Record<string, unknown> | null
        }>} />
      </div>
    </div>
  )
}
