import { syncBDNS, getBdnsSyncStatus, SPAIN_VPDS } from '@/lib/bdns-sync'
import { getAdminCaller } from '@/lib/admin-auth'
import { logAdminEvent } from '@/lib/admin-audit'
import { createAdminClient } from '@/lib/supabase/admin'
import { runGrantPublisherSync } from '@/lib/grant-system'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // seconds (Vercel Pro)

function isAuthorized(request: Request): boolean {
  const secret = process.env.SYNC_SECRET
  if (!secret) return true // no secret configured → open (dev mode)
  const auth = request.headers.get('authorization') ?? ''
  return auth === `Bearer ${secret}`
}

export async function GET(request: Request) {
  const caller = await getAdminCaller()
  if (!isAuthorized(request) && !caller) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const status = await getBdnsSyncStatus()
    return Response.json({ ...status, vpds: SPAIN_VPDS })
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'unknown_error' },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  const caller = await getAdminCaller()
  if (!isAuthorized(request) && !caller) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: {
    vpds?: string[]
    maxPagesPerVpd?: number
    pageSize?: number
    persistArtifacts?: boolean
    fetchSourceDocuments?: boolean
  } = {}
  try {
    body = await request.json()
  } catch {
    // empty body is fine
  }

  try {
    const admin = createAdminClient()
    let capturedStats: Awaited<ReturnType<typeof syncBDNS>> | undefined

    await runGrantPublisherSync('bdns', async ({ startedAt }) => {
      capturedStats = await syncBDNS({
        vpds: body.vpds,
        maxPagesPerVpd: body.maxPagesPerVpd,
        pageSize: body.pageSize,
        persistArtifacts: body.persistArtifacts,
        fetchSourceDocuments: body.fetchSourceDocuments,
      })

      const [{ count: published }, { count: rejected }] = await Promise.all([
        admin
          .from('grant_calls')
          .select('id', { count: 'exact', head: true })
          .eq('source', 'bdns')
          .gte('updated_at', startedAt)
          .eq('publication_status', 'published'),
        admin
          .from('grant_calls')
          .select('id', { count: 'exact', head: true })
          .eq('source', 'bdns')
          .gte('updated_at', startedAt)
          .eq('publication_status', 'rejected'),
      ])

      return {
        status: 'success',
        discoveredCount: capturedStats.totalGrantsUpserted,
        fetchedCount: capturedStats.totalGrantsUpserted,
        enrichedCount: capturedStats.totalGrantsUpserted,
        publishedCount: published ?? 0,
        rejectedCount: rejected ?? 0,
        metadata: {
          totalPagesProcessed: capturedStats.totalPagesProcessed,
          durationMs: capturedStats.durationMs,
        },
      }
    })

    if (!capturedStats) {
      throw new Error('sync_bdns_did_not_return_stats')
    }
    const stats = capturedStats

    await logAdminEvent({
      actorUserId: caller?.id,
      action: 'sync_bdns',
      entityType: 'operation',
      entityId: 'bdns',
      targetLabel: 'Sincronizar BDNS',
      status: 'success',
      metadata: {
        totalGrantsUpserted: stats.totalGrantsUpserted,
        totalPagesProcessed: stats.totalPagesProcessed,
        durationMs: stats.durationMs,
      },
    })
    return Response.json({ ok: true, stats })
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'unknown_error'
    await logAdminEvent({
      actorUserId: caller?.id,
      action: 'sync_bdns',
      entityType: 'operation',
      entityId: 'bdns',
      targetLabel: 'Sincronizar BDNS',
      status: 'error',
      metadata: { error: errorMessage },
    })
    return Response.json(
      { ok: false, error: errorMessage },
      { status: 500 },
    )
  }
}
