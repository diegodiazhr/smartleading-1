import { getAdminCaller } from '@/lib/admin-auth'
import { logAdminEvent } from '@/lib/admin-audit'
import { syncGrantSources } from '@/lib/grant-system'

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

  let body: {
    publisherCodes?: string[]
    maxPagesPerVpd?: number
    pageSize?: number
    persistArtifacts?: boolean
    fetchSourceDocuments?: boolean
    force?: boolean
  } = {}

  try {
    body = await request.json()
  } catch {
    // empty body is valid
  }

  try {
    const result = await syncGrantSources(body)
    await logAdminEvent({
      actorUserId: caller?.id,
      action: 'sync_grant_sources',
      entityType: 'operation',
      entityId: body.publisherCodes?.join(',') ?? 'all',
      targetLabel: 'Sincronizar fuentes oficiales',
      status: 'success',
      metadata: {
        publishers: result.totals.publishers,
        discovered: result.totals.discovered,
        published: result.totals.published,
        rejected: result.totals.rejected,
      },
    })

    return Response.json({ ok: true, result })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown_error'
    await logAdminEvent({
      actorUserId: caller?.id,
      action: 'sync_grant_sources',
      entityType: 'operation',
      entityId: body.publisherCodes?.join(',') ?? 'all',
      targetLabel: 'Sincronizar fuentes oficiales',
      status: 'error',
      metadata: { error: message },
    })

    return Response.json({ ok: false, error: message }, { status: 500 })
  }
}
