import { syncBDNS } from '@/lib/bdns-sync'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET(request: Request) {
  // Vercel cron sends Authorization: Bearer <CRON_SECRET>
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = request.headers.get('authorization') ?? ''
    if (auth !== `Bearer ${cronSecret}`) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  try {
    const stats = await syncBDNS({ maxPagesPerVpd: 5 })
    console.log('[cron/sync-bdns]', JSON.stringify({ ok: true, stats }))
    return Response.json({ ok: true, stats })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error'
    console.error('[cron/sync-bdns] error:', message)
    return Response.json({ ok: false, error: message }, { status: 500 })
  }
}
