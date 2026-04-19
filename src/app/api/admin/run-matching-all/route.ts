import { createAdminClient } from '@/lib/supabase/admin'
import { runMatching } from '@/lib/matching'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

function isAuthorized(request: Request): boolean {
  const secret = process.env.SYNC_SECRET
  if (!secret) return true
  const auth = request.headers.get('authorization') ?? ''
  return auth === `Bearer ${secret}`
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
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

  return Response.json({ ok: true, total: companies.length, results })
}
