import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateQuestionnaire } from '@/lib/document-generator'
import type { DocumentType } from '@/lib/application-guide'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
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

  if (!userRecord?.organization_id) {
    return Response.json({ error: 'No organization' }, { status: 403 })
  }

  const { data: app } = await admin
    .from('applications')
    .select('*, grant:grants(*)')
    .eq('id', id)
    .eq('organization_id', userRecord.organization_id)
    .single()

  if (!app) return Response.json({ error: 'Application not found' }, { status: 404 })

  const { data: company } = await admin
    .from('companies')
    .select('*')
    .eq('organization_id', userRecord.organization_id)
    .single()

  if (!company) return Response.json({ error: 'Company not found' }, { status: 404 })

  const body = await req.json() as {
    document_name: string
    document_type: DocumentType
    template_hint?: string
  }

  const grant = app.grant as Record<string, unknown>

  try {
    const questions = await generateQuestionnaire({
      documentName: body.document_name,
      documentType: body.document_type,
      templateHint: body.template_hint,
      grant: {
        title: (grant.title as string) ?? '',
        organismo: (grant.organismo as string) ?? null,
        summary: (grant.summary as string) ?? null,
        body: (grant.body as string) ?? null,
        grant_type: (grant.grant_type as string) ?? 'fondo_perdido',
        scope: (grant.scope as string) ?? 'nacional',
        budget_per_company_max: (grant.budget_per_company_max as number) ?? null,
        tags: (grant.tags as string[]) ?? [],
      },
      company: {
        name: company.name,
        cif: company.cif,
        region: company.region,
        municipality: company.municipality,
        employees_count: company.employees_count ?? 0,
        revenue_annual: Number(company.revenue_annual ?? 0),
        founding_date: company.founding_date,
        is_startup: company.is_startup ?? false,
        has_rd: company.has_rd ?? false,
        cnae_primary: company.cnae_primary,
        cnae_secondary: company.cnae_secondary ?? [],
        website: company.website,
      },
    })

    return Response.json({ questions })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Questionnaire generation failed'
    return Response.json({ error: msg }, { status: 500 })
  }
}
