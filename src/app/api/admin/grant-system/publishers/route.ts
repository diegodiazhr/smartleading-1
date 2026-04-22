import { getAdminCaller } from '@/lib/admin-auth'
import { getGrantSystemPublishers } from '@/lib/grant-system'

export const dynamic = 'force-dynamic'

export async function GET() {
  const caller = await getAdminCaller()
  if (!caller) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const publishers = await getGrantSystemPublishers()
    return Response.json({ publishers })
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'unknown_error' },
      { status: 500 },
    )
  }
}
