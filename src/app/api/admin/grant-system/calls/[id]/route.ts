import { getAdminCaller } from '@/lib/admin-auth'
import { getGrantPipelineCallDetail } from '@/lib/grant-system'

export const dynamic = 'force-dynamic'

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const caller = await getAdminCaller()
  if (!caller) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id } = await params
    const detail = await getGrantPipelineCallDetail(id)
    if (!detail) {
      return Response.json({ error: 'Not found' }, { status: 404 })
    }

    return Response.json(detail)
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'unknown_error' },
      { status: 500 },
    )
  }
}
