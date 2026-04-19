import { runMatching } from '@/lib/matching'

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
  if (!isAuthorized(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { companyId } = await params

  try {
    const stats = await runMatching(companyId)
    return Response.json({ ok: true, stats })
  } catch (err) {
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : 'unknown' },
      { status: 500 },
    )
  }
}
