import { getAdminCaller } from '@/lib/admin-auth'
import { logAdminEvent } from '@/lib/admin-audit'
import { getGrantSystemPublishers, setGrantPublisherActiveState, syncGrantSources } from '@/lib/grant-system'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function PATCH(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const caller = await getAdminCaller()
  if (!caller) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { code } = await params
  let body: { isActive?: boolean } = {}

  try {
    body = await request.json()
  } catch {
    // empty body is valid, but isActive remains undefined
  }

  if (typeof body.isActive !== 'boolean') {
    return Response.json({ error: 'isActive_boolean_required' }, { status: 400 })
  }

  try {
    const publisher = await setGrantPublisherActiveState(code, body.isActive)
    const summaries = await getGrantSystemPublishers()
    const summary = summaries.find(item => item.publisher.code === code) ?? null

    await logAdminEvent({
      actorUserId: caller.id,
      action: body.isActive ? 'enable_grant_publisher' : 'disable_grant_publisher',
      entityType: 'grant_publisher',
      entityId: publisher.id,
      targetLabel: publisher.name,
      status: 'success',
      metadata: { code: publisher.code, isActive: publisher.is_active },
    })

    return Response.json({ ok: true, publisher, summary })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown_error'
    await logAdminEvent({
      actorUserId: caller.id,
      action: 'toggle_grant_publisher',
      entityType: 'grant_publisher',
      entityId: code,
      targetLabel: code,
      status: 'error',
      metadata: { error: message, requestedState: body.isActive ?? null },
    })

    return Response.json({ ok: false, error: message }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const caller = await getAdminCaller()
  if (!caller) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { code } = await params
  let body: { maxItems?: number } = {}

  try {
    body = await request.json()
  } catch {
    // empty body is valid
  }

  try {
    const publishers = await getGrantSystemPublishers()
    const summary = publishers.find(item => item.publisher.code === code)
    if (!summary) {
      return Response.json({ error: 'publisher_not_found' }, { status: 404 })
    }
    if (!summary.publisher.is_active) {
      return Response.json({ error: 'publisher_inactive' }, { status: 400 })
    }

    const result = await syncGrantSources({
      publisherCodes: [code],
      pageSize: Math.max(4, Math.min(20, body.maxItems ?? 8)),
      force: true,
    })
    const refreshed = (await getGrantSystemPublishers()).find(item => item.publisher.code === code) ?? null

    await logAdminEvent({
      actorUserId: caller.id,
      action: 'sync_grant_publisher',
      entityType: 'grant_publisher',
      entityId: summary.publisher.id,
      targetLabel: summary.publisher.name,
      status: 'success',
      metadata: {
        code,
        discovered: result.totals.discovered,
        published: result.totals.published,
        rejected: result.totals.rejected,
      },
    })

    return Response.json({ ok: true, result, summary: refreshed })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown_error'
    await logAdminEvent({
      actorUserId: caller.id,
      action: 'sync_grant_publisher',
      entityType: 'grant_publisher',
      entityId: code,
      targetLabel: code,
      status: 'error',
      metadata: { error: message },
    })

    return Response.json({ ok: false, error: message }, { status: 500 })
  }
}
