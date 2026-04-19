import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateDocument } from '@/lib/document-generator'
import type { DocumentType } from '@/lib/application-guide'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(
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

  if (!userRecord?.organization_id) {
    return Response.json({ error: 'No organization' }, { status: 403 })
  }

  // Load application + grant + company
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
    doc_id: string
    document_name: string
    document_type: DocumentType
    template_hint: string
    intake: Record<string, string | number>
  }

  const grant = app.grant as Record<string, unknown>

  try {
    const content = await generateDocument({
      documentName: body.document_name,
      documentType: body.document_type,
      templateHint: body.template_hint,
      grant: {
        title: (grant.title as string) ?? '',
        organismo: (grant.organismo as string) ?? null,
        summary: (grant.summary as string) ?? null,
        body: (grant.body as string) ?? null,
        deadline: (grant.deadline as string) ?? null,
        grant_type: (grant.grant_type as string) ?? 'fondo_perdido',
        scope: (grant.scope as string) ?? 'nacional',
        source_url: (grant.source_url as string) ?? null,
        budget_per_company_max: (grant.budget_per_company_max as number) ?? null,
        tags: (grant.tags as string[]) ?? [],
      },
      company: {
        name: company.name,
        cif: company.cif,
        region: company.region,
        municipality: company.municipality,
        employees_count: company.employees_count,
        revenue_annual: company.revenue_annual,
        founding_date: company.founding_date,
        is_startup: company.is_startup,
        has_rd: company.has_rd,
        cnae_primary: company.cnae_primary,
        website: company.website,
      },
      requestedAmount: app.requested_amount ? Number(app.requested_amount) : null,
      intake: body.intake,
    })

    // Persist generated document in application metadata
    const meta = (app.metadata ?? {}) as Record<string, unknown>
    const generatedDocs = (meta.generated_docs ?? {}) as Record<string, unknown>
    const existing = generatedDocs[body.doc_id] as Record<string, unknown> | undefined

    await admin.from('applications').update({
      metadata: {
        ...meta,
        generated_docs: {
          ...generatedDocs,
          [body.doc_id]: {
            content,
            intake: body.intake,
            document_name: body.document_name,
            document_type: body.document_type,
            generated_at: new Date().toISOString(),
            version: ((existing?.version as number) ?? 0) + 1,
          },
        },
      },
      updated_at: new Date().toISOString(),
    }).eq('id', id)

    return Response.json({ content })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Generation failed'
    return Response.json({ error: msg }, { status: 500 })
  }
}
