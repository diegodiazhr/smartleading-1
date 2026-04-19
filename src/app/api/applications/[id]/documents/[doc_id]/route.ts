import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; doc_id: string }> }
) {
  const { id, doc_id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const { data: userRecord } = await admin
    .from('users').select('organization_id').eq('id', user.id).single()

  const { data: app } = await admin
    .from('applications').select('metadata, organization_id').eq('id', id).single()

  if (!app || app.organization_id !== userRecord?.organization_id) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  const { content } = await req.json() as { content: string }

  const meta = (app.metadata ?? {}) as Record<string, unknown>
  const generatedDocs = (meta.generated_docs ?? {}) as Record<string, unknown>
  const existing = (generatedDocs[doc_id] ?? {}) as Record<string, unknown>

  await admin.from('applications').update({
    metadata: {
      ...meta,
      generated_docs: {
        ...generatedDocs,
        [doc_id]: { ...existing, content, edited_at: new Date().toISOString() },
      },
    },
    updated_at: new Date().toISOString(),
  }).eq('id', id)

  return Response.json({ ok: true })
}
