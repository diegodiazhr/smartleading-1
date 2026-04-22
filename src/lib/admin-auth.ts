import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export interface AdminCaller {
  id: string
  role: string | null
  is_superadmin: boolean
}

export async function getAdminCaller(): Promise<AdminCaller | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const admin = createAdminClient()
  const { data: record } = await admin
    .from('users')
    .select('id, role, is_superadmin')
    .eq('id', user.id)
    .single()

  if (!record) return null

  const canAccess = record.is_superadmin || record.role === 'admin'
  if (!canAccess) return null

  return {
    id: record.id,
    role: record.role,
    is_superadmin: record.is_superadmin,
  }
}
