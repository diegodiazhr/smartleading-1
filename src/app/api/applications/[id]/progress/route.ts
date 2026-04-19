import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

// PATCH /api/applications/[id]/progress — toggle a step or document as completed/uncompleted
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const { data: userRecord } = await admin
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  const { data: app } = await admin
    .from('applications')
    .select('id, organization_id, metadata')
    .eq('id', id)
    .single()

  if (!app) return Response.json({ error: 'Not found' }, { status: 404 })
  if (app.organization_id !== userRecord?.organization_id) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { item_id, completed } = await req.json() as { item_id: string; completed: boolean }
  if (!item_id) return Response.json({ error: 'item_id required' }, { status: 400 })

  const meta = (app.metadata ?? {}) as Record<string, unknown>
  const current = (meta.completed_items ?? []) as string[]

  const updated_items = completed
    ? [...new Set([...current, item_id])]
    : current.filter((i: string) => i !== item_id)

  const { error } = await admin
    .from('applications')
    .update({
      metadata: { ...meta, completed_items: updated_items },
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ completed_items: updated_items })
}
