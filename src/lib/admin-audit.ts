import { createAdminClient } from '@/lib/supabase/admin'
import type { Json } from '@/lib/types'

interface LogAdminEventInput {
  actorUserId?: string | null
  action: string
  entityType?: string | null
  entityId?: string | null
  targetLabel?: string | null
  status?: 'info' | 'success' | 'error'
  metadata?: Json
}

export async function logAdminEvent({
  actorUserId = null,
  action,
  entityType = null,
  entityId = null,
  targetLabel = null,
  status = 'info',
  metadata = {},
}: LogAdminEventInput) {
  try {
    const admin = createAdminClient()
    await admin.from('admin_audit_logs').insert({
      actor_user_id: actorUserId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      target_label: targetLabel,
      status,
      metadata,
    })
  } catch {
    // Audit should never block the primary admin action.
  }
}
