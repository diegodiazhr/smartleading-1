import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { logAdminEvent } from '@/lib/admin-audit'

export const dynamic = 'force-dynamic'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: caller } = await admin.from('users').select('is_superadmin').eq('id', user.id).single()
  if (!caller?.is_superadmin) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { userId } = await params
  const body = await request.json() as { is_active?: boolean; role?: string }

  const updates: { is_active?: boolean; role?: string } = {}
  if (typeof body.is_active === 'boolean') updates.is_active = body.is_active
  if (typeof body.role === 'string' && body.role.trim()) updates.role = body.role

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: 'No changes requested' }, { status: 400 })
  }

  const { error } = await admin.from('users').update(updates).eq('id', userId)
  if (error) return Response.json({ error: error.message }, { status: 500 })

  await logAdminEvent({
    actorUserId: user.id,
    action: 'update_user',
    entityType: 'user',
    entityId: userId,
    targetLabel: 'Actualizar usuario',
    status: 'success',
    metadata: updates,
  })

  return Response.json({ ok: true })
}
