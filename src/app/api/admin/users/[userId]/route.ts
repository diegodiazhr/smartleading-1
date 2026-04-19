import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

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
  const body = await request.json() as { is_active?: boolean }

  const { error } = await admin.from('users').update({ is_active: body.is_active }).eq('id', userId)
  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ ok: true })
}
