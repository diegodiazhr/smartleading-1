import { runMatching } from '@/lib/matching'
import type { MatchStats } from '@/lib/matching'
import { getAdminCaller } from '@/lib/admin-auth'
import { logAdminEvent } from '@/lib/admin-audit'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

function isAuthorized(request: Request): boolean {
  const secret = process.env.SYNC_SECRET
  if (!secret) return true
  const auth = request.headers.get('authorization') ?? ''
  return auth === `Bearer ${secret}`
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ companyId: string }> },
) {
  const caller = await getAdminCaller()
  if (!isAuthorized(request) && !caller) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { companyId } = await params

  try {
    const stats = await runMatching(companyId)
    await logAdminEvent({
      actorUserId: caller?.id,
      action: 'run_matching_company',
      entityType: 'company',
      entityId: companyId,
      targetLabel: 'Matching individual',
      status: 'success',
      metadata: matchStatsToMetadata(stats),
    })
    return Response.json({ ok: true, stats })
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'unknown'
    await logAdminEvent({
      actorUserId: caller?.id,
      action: 'run_matching_company',
      entityType: 'company',
      entityId: companyId,
      targetLabel: 'Matching individual',
      status: 'error',
      metadata: { error: errorMessage },
    })
    return Response.json(
      { ok: false, error: errorMessage },
      { status: 500 },
    )
  }
}

function matchStatsToMetadata(stats: MatchStats) {
  return {
    totalGrants: stats.totalGrants,
    matched: stats.matched,
    highFit: stats.highFit,
    totalPotential: stats.totalPotential,
    durationMs: stats.durationMs,
  }
}
