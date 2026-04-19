import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateApplicationGuide } from '@/lib/application-guide'
import { randomUUID } from 'crypto'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const { data: userRecord } = await admin
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  if (!userRecord?.organization_id) {
    return Response.json({ error: 'No organization found' }, { status: 400 })
  }

  const { data: company } = await admin
    .from('companies')
    .select('*')
    .eq('organization_id', userRecord.organization_id)
    .single()

  if (!company) {
    return Response.json({ error: 'No company found' }, { status: 400 })
  }

  const body = await req.json() as {
    grant_id: string
    requested_amount?: number | null
    notes?: string | null
  }

  if (!body.grant_id) {
    return Response.json({ error: 'grant_id is required' }, { status: 400 })
  }

  // Check duplicate
  const { data: existing } = await admin
    .from('applications')
    .select('id')
    .eq('company_id', company.id)
    .eq('grant_id', body.grant_id)
    .maybeSingle()

  if (existing) {
    return Response.json({ application: existing, already_existed: true })
  }

  // Fetch full grant context for the guide
  const { data: grant } = await admin
    .from('grants')
    .select('*')
    .eq('id', body.grant_id)
    .single()

  if (!grant) {
    return Response.json({ error: 'Grant not found' }, { status: 404 })
  }

  // Generate AI guide (non-blocking fallback if OpenAI fails)
  let guideMetadata: Record<string, unknown> = { guide_status: 'pending' }
  try {
    const guide = await generateApplicationGuide(
      {
        title: grant.title,
        organismo: grant.organismo,
        summary: grant.summary,
        body: grant.body,
        deadline: grant.deadline,
        opening_date: grant.opening_date,
        grant_type: grant.grant_type,
        scope: grant.scope,
        regions: grant.regions ?? [],
        sectors: grant.sectors ?? [],
        cnae_codes: grant.cnae_codes ?? [],
        budget_per_company_min: grant.budget_per_company_min,
        budget_per_company_max: grant.budget_per_company_max,
        min_employees: grant.min_employees,
        max_employees: grant.max_employees,
        source_url: grant.source_url,
        tags: grant.tags ?? [],
        keywords: grant.keywords ?? [],
      },
      {
        name: company.name,
        cif: company.cif,
        region: company.region,
        employees_count: company.employees_count,
        revenue_annual: company.revenue_annual,
        is_startup: company.is_startup,
        has_rd: company.has_rd,
        cnae_primary: company.cnae_primary,
        founding_date: company.founding_date,
      }
    )
    guideMetadata = { guide, guide_status: 'ready', completed_items: [] }
  } catch (err) {
    console.error('Guide generation failed:', err)
    guideMetadata = { guide_status: 'failed', completed_items: [] }
  }

  const now = new Date().toISOString()
  const newApp = {
    id: randomUUID(),
    company_id: company.id,
    organization_id: userRecord.organization_id,
    grant_id: body.grant_id,
    status: 'draft' as const,
    requested_amount: body.requested_amount ?? null,
    notes: body.notes ?? null,
    approved_amount: null,
    justified_amount: 0,
    submission_date: null,
    resolution_date: null,
    justification_deadline: null,
    reference_number: null,
    assigned_to: null,
    ai_quality_score: null,
    metadata: guideMetadata,
    created_at: now,
    updated_at: now,
  }

  const { data: application, error } = await admin
    .from('applications')
    .insert(newApp)
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })

  await admin.from('application_events').insert({
    id: randomUUID(),
    application_id: application.id,
    type: 'created',
    title: 'Expediente creado',
    description: guideMetadata.guide_status === 'ready'
      ? 'Expediente iniciado con guía de presentación generada por IA'
      : 'Expediente iniciado',
    metadata: {},
    created_by: user.id,
    created_at: now,
  })

  return Response.json({ application })
}
