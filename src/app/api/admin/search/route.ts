import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminCaller } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

interface SearchResult {
  id: string
  type: 'company' | 'user' | 'grant' | 'application'
  title: string
  subtitle: string
  href: string
}

interface ApplicationSearchRow {
  id: string
  status: string
  reference_number: string | null
  company: { name?: string | null } | null
  grant: { title?: string | null } | null
}

export async function GET(request: Request) {
  const caller = await getAdminCaller()
  if (!caller) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const q = (searchParams.get('q') ?? '').trim()
  if (q.length < 2) {
    return Response.json({ results: [] })
  }

  const admin = createAdminClient()
  const ilike = `%${q}%`

  const [
    { data: companies },
    { data: users },
    { data: grants },
    { data: applications },
  ] = await Promise.all([
    admin
      .from('companies')
      .select('id, name, cif, region')
      .or(`name.ilike.${ilike},cif.ilike.${ilike},region.ilike.${ilike}`)
      .order('created_at', { ascending: false })
      .limit(5),
    admin
      .from('users')
      .select('id, email, full_name, role')
      .or(`email.ilike.${ilike},full_name.ilike.${ilike}`)
      .order('created_at', { ascending: false })
      .limit(5),
    admin
      .from('grants')
      .select('id, title, organismo, status')
      .or(`title.ilike.${ilike},organismo.ilike.${ilike},external_id.ilike.${ilike}`)
      .order('updated_at', { ascending: false })
      .limit(5),
    admin
      .from('applications')
      .select('id, status, reference_number, updated_at, company:companies(name), grant:grants(title)')
      .order('updated_at', { ascending: false })
      .limit(40),
  ])

  const applicationRows = (applications ?? []) as unknown as ApplicationSearchRow[]

  const applicationResults: SearchResult[] = applicationRows
    .filter(app => {
      const haystack = [
        app.reference_number,
        app.company?.name,
        app.grant?.title,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(q.toLowerCase())
    })
    .slice(0, 5)
    .map(app => ({
      id: app.id,
      type: 'application',
      title: app.company?.name ?? 'Expediente',
      subtitle: [
        app.reference_number ?? 'Sin referencia',
        app.grant?.title,
        app.status,
      ]
        .filter(Boolean)
        .join(' · '),
      href: `/dashboard/expedientes/${app.id}`,
    }))

  const results: SearchResult[] = [
    ...(companies ?? []).map(company => ({
      id: company.id,
      type: 'company' as const,
      title: company.name,
      subtitle: [company.cif, company.region].filter(Boolean).join(' · ') || 'Empresa',
      href: '/admin/empresas',
    })),
    ...(users ?? []).map(user => ({
      id: user.id,
      type: 'user' as const,
      title: user.full_name ?? user.email,
      subtitle: [user.email, user.role].filter(Boolean).join(' · '),
      href: '/admin/usuarios',
    })),
    ...(grants ?? []).map(grant => ({
      id: grant.id,
      type: 'grant' as const,
      title: grant.title,
      subtitle: [grant.organismo, grant.status].filter(Boolean).join(' · '),
      href: '/admin/convocatorias',
    })),
    ...applicationResults,
  ].slice(0, 16)

  return Response.json({ results })
}
