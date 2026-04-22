import { createAdminClient } from '@/lib/supabase/admin'
import { runMatching } from '@/lib/matching'
import { getAdminCaller } from '@/lib/admin-auth'
import { logAdminEvent } from '@/lib/admin-audit'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

function isAuthorized(request: Request): boolean {
  const secret = process.env.SYNC_SECRET
  if (!secret) return true
  const auth = request.headers.get('authorization') ?? ''
  return auth === `Bearer ${secret}`
}

export async function POST(request: Request) {
  const caller = await getAdminCaller()
  if (!isAuthorized(request) && !caller) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const { data: companies, error } = await admin
    .from('companies')
    .select('id, name')

  if (error) return Response.json({ error: error.message }, { status: 500 })
  if (!companies || companies.length === 0) {
    return Response.json({ ok: true, results: [] })
  }

  const results: Array<{ companyId: string; name: string; ok: boolean; stats?: object; error?: string }> = []

  for (const company of companies) {
    try {
      const stats = await runMatching(company.id)
      results.push({ companyId: company.id, name: company.name, ok: true, stats })
    } catch (err) {
      results.push({
        companyId: company.id,
        name: company.name,
        ok: false,
        error: err instanceof Error ? err.message : 'unknown',
      })
    }
  }

  await logAdminEvent({
    actorUserId: caller?.id,
    action: 'run_matching_all',
    entityType: 'operation',
    entityId: 'matching_all',
    targetLabel: 'Recalcular matching',
    status: results.every(result => result.ok) ? 'success' : 'error',
    metadata: {
      total: companies.length,
      ok: results.filter(result => result.ok).length,
      failed: results.filter(result => !result.ok).length,
    },
  })

  return Response.json({ ok: true, total: companies.length, results })
}
