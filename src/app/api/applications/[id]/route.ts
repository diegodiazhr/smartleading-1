import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { randomUUID } from 'crypto'

export const dynamic = 'force-dynamic'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // Verify the application belongs to the user's company
  const { data: userRecord } = await admin
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!userRecord?.organization_id) {
    return Response.json({ error: 'No organization' }, { status: 403 })
  }

  const { data: app } = await admin
    .from('applications')
    .select('id, status, organization_id')
    .eq('id', id)
    .single()

  if (!app) return Response.json({ error: 'Not found' }, { status: 404 })
  if (app.organization_id !== userRecord.organization_id) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json() as {
    status?: string
    requested_amount?: number | null
    approved_amount?: number | null
    reference_number?: string | null
    submission_date?: string | null
    resolution_date?: string | null
    justification_deadline?: string | null
    notes?: string | null
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.status !== undefined) updates.status = body.status
  if (body.requested_amount !== undefined) updates.requested_amount = body.requested_amount
  if (body.approved_amount !== undefined) updates.approved_amount = body.approved_amount
  if (body.reference_number !== undefined) updates.reference_number = body.reference_number
  if (body.submission_date !== undefined) updates.submission_date = body.submission_date
  if (body.resolution_date !== undefined) updates.resolution_date = body.resolution_date
  if (body.justification_deadline !== undefined) updates.justification_deadline = body.justification_deadline
  if (body.notes !== undefined) updates.notes = body.notes

  // Auto-set submission_date when status changes to submitted
  if (body.status === 'submitted' && !body.submission_date) {
    updates.submission_date = new Date().toISOString()
  }

  const { data: updated, error } = await admin
    .from('applications')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Create timeline event if status changed
  if (body.status && body.status !== app.status) {
    const eventLabels: Record<string, string> = {
      review: 'En revisión',
      submitted: 'Solicitud enviada',
      subsanacion: 'Subsanación requerida',
      approved: 'Subvención aprobada',
      denied: 'Solicitud denegada',
      pending_justification: 'Pendiente de justificación',
      justified: 'Justificación enviada',
      closed: 'Expediente cerrado',
    }
    await admin.from('application_events').insert({
      id: randomUUID(),
      application_id: id,
      type: 'status_change',
      title: eventLabels[body.status] ?? `Estado: ${body.status}`,
      description: `Estado cambiado de ${app.status} a ${body.status}`,
      metadata: { from: app.status, to: body.status },
      created_by: user.id,
      created_at: new Date().toISOString(),
    })
  }

  return Response.json({ application: updated })
}
