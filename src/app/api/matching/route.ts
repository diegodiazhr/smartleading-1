import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { runMatching } from '@/lib/matching'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const { data: userRecord } = await admin
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!userRecord?.organization_id) {
    return Response.json({ error: 'No hay empresa configurada' }, { status: 404 })
  }

  const { data: company } = await admin
    .from('companies')
    .select('id')
    .eq('organization_id', userRecord.organization_id)
    .single()

  if (!company) {
    return Response.json({ error: 'No hay empresa configurada' }, { status: 404 })
  }

  try {
    const stats = await runMatching(company.id)
    return Response.json({ ok: true, stats })
  } catch (err) {
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : 'unknown_error' },
      { status: 500 },
    )
  }
}
