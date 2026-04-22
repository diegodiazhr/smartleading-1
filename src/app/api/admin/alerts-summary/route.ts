import { getAdminCaller } from '@/lib/admin-auth'
import { getAdminDerivedAlerts } from '@/lib/admin-alerts'

export const dynamic = 'force-dynamic'

export async function GET() {
  const caller = await getAdminCaller()
  if (!caller) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const alerts = await getAdminDerivedAlerts()

  return Response.json({
    count: alerts.length,
    alerts: alerts.slice(0, 5),
  })
}
