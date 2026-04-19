import { syncBDNS, getBdnsSyncStatus, SPAIN_VPDS } from '@/lib/bdns-sync'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // seconds (Vercel Pro)

function isAuthorized(request: Request): boolean {
  const secret = process.env.SYNC_SECRET
  if (!secret) return true // no secret configured → open (dev mode)
  const auth = request.headers.get('authorization') ?? ''
  return auth === `Bearer ${secret}`
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
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
  if (!isAuthorized(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { vpds?: string[]; maxPagesPerVpd?: number; pageSize?: number } = {}
  try {
    body = await request.json()
  } catch {
    // empty body is fine
  }

  try {
    const stats = await syncBDNS({
      vpds: body.vpds,
      maxPagesPerVpd: body.maxPagesPerVpd, // uses lib default (20) when undefined
      pageSize: body.pageSize,             // uses lib default (50) when undefined
    })
    return Response.json({ ok: true, stats })
  } catch (err) {
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : 'unknown_error' },
      { status: 500 },
    )
  }
}
