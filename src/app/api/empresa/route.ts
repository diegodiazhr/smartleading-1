import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

// ── GET — fetch company for the authenticated user ─────────────────────────

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // Look up the user's organization
  const { data: userRecord } = await admin
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!userRecord?.organization_id) {
    return Response.json({ company: null })
  }

  const { data: company } = await admin
    .from('companies')
    .select('*')
    .eq('organization_id', userRecord.organization_id)
    .single()

  return Response.json({ company: company ?? null })
}

// ── POST — create organization + user record + company (onboarding) ────────

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const admin = createAdminClient()
    const now = new Date().toISOString()

    // Idempotent: if org already exists, reuse it
    const { data: existingUser } = await admin
      .from('users')
      .select('organization_id')
      .eq('id', user.id)
      .single()

    let organizationId: string

    if (existingUser?.organization_id) {
      organizationId = existingUser.organization_id
    } else {
      // Create organization
      const { data: org, error: orgError } = await admin
        .from('organizations')
        .insert({
          name: body.name || user.email,
          type: 'empresa',
          plan: 'free',
          white_label_config: {},
          commission_rate: 0,
          created_at: now,
          updated_at: now,
        })
        .select('id')
        .single()

      if (orgError || !org) {
        return Response.json({ error: orgError?.message ?? 'Failed to create organization' }, { status: 500 })
      }
      organizationId = org.id

      // Create user record
      const { error: userInsertError } = await admin.from('users').insert({
        id: user.id,
        organization_id: organizationId,
        email: user.email ?? '',
        full_name: body.full_name ?? null,
        role: 'owner',
        notification_prefs: {},
        avatar_url: null,
        created_at: now,
        updated_at: now,
      })

      if (userInsertError) {
        return Response.json({ error: userInsertError.message }, { status: 500 })
      }
    }

    // Check if company already exists for this org (idempotency)
    const { data: existingCompany } = await admin
      .from('companies')
      .select('*')
      .eq('organization_id', organizationId)
      .maybeSingle()

    if (existingCompany) {
      return Response.json({ company: existingCompany }, { status: 200 })
    }

    // Create company
    const { data: company, error: companyError } = await admin
      .from('companies')
      .insert({
        organization_id: organizationId,
        name: body.name,
        cif: body.cif ?? '',
        cnae_primary: body.cnae_primary ?? null,
        cnae_secondary: body.cnae_secondary ?? [],
        employees_count: Number(body.employees_count) || 0,
        revenue_annual: Number(body.revenue_annual) || 0,
        revenue_growth: Number(body.revenue_growth) || 0,
        founding_date: body.founding_date ?? null,
        region: body.region ?? null,
        municipality: body.municipality ?? null,
        address: body.address ?? null,
        website: body.website ?? null,
        is_startup: Boolean(body.is_startup),
        has_rd: Boolean(body.has_rd),
        export_percentage: Number(body.export_percentage) || 0,
        digitalization_level: Math.min(5, Math.max(1, Number(body.digitalization_level) || 3)),
        innovation_level: Math.min(5, Math.max(1, Number(body.innovation_level) || 3)),
        sustainability_score: Math.min(5, Math.max(1, Number(body.sustainability_score) || 3)),
        has_tax_debts: Boolean(body.has_tax_debts),
        has_social_security_debts: Boolean(body.has_social_security_debts),
        approved_grants_count: 0,
        total_grants_received: 0,
        doc_score: 0,
        created_at: now,
        updated_at: now,
      })
      .select('*')
      .single()

    if (companyError || !company) {
      return Response.json({ error: companyError?.message ?? 'Failed to create company' }, { status: 500 })
    }

    return Response.json({ company }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/empresa]', err)
    return Response.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    )
  }
}

// ── PATCH — update company profile ────────────────────────────────────────

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const admin = createAdminClient()

  const { data: userRecord } = await admin
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!userRecord?.organization_id) {
    return Response.json({ error: 'No company found' }, { status: 404 })
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  const allowed = [
    'name', 'cif', 'cnae_primary', 'cnae_secondary', 'employees_count',
    'revenue_annual', 'revenue_growth', 'founding_date', 'region', 'municipality',
    'address', 'website', 'is_startup', 'has_rd', 'export_percentage',
    'digitalization_level', 'innovation_level', 'sustainability_score',
    'has_tax_debts', 'has_social_security_debts',
  ] as const

  for (const key of allowed) {
    if (key in body) updates[key] = body[key]
  }

  const { data: company, error } = await admin
    .from('companies')
    .update(updates)
    .eq('organization_id', userRecord.organization_id)
    .select('*')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ company })
}
