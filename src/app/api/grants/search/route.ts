import { createClient } from '@/lib/supabase/server'
import { searchGrantsForUser } from '@/lib/grant-search'
import type { GrantSearchResult } from '@/lib/grant-search'

export type { GrantSearchResult } from '@/lib/grant-search'

export const dynamic = 'force-dynamic'

export interface SearchResponse {
  grants: GrantSearchResult[]
  total: number
  page: number
  hasMore: boolean
  matchCount?: number // total matched grants for the company (for "para mí" badge)
}

const PAGE_SIZE = 25

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)

  const q = (searchParams.get('q') ?? '').trim()
  const scope = searchParams.get('scope') ?? ''
  const grantType = searchParams.get('grant_type') ?? ''
  const status = searchParams.get('status') ?? ''
  const minAmount = Number(searchParams.get('min_amount') ?? 0)
  const paraMe = searchParams.get('para_mi') === 'true'
  const sort = searchParams.get('sort') ?? (paraMe ? 'relevancia' : 'deadline')
  const page = Math.max(0, Number(searchParams.get('page') ?? 0))
  const beneficiary = searchParams.get('beneficiary') ?? ''
  const sourceLevel = searchParams.get('source_level') ?? ''
  const territory = searchParams.get('territory') ?? ''
  const companyStage = searchParams.get('company_stage') ?? ''
  const legalForm = searchParams.get('legal_form') ?? ''
  const quality = searchParams.get('quality') ?? ''
  const hasOfficialDocs = searchParams.get('has_official_docs') === 'true'

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const results = await searchGrantsForUser(user.id, {
    q,
    scope,
    grantType,
    status,
    minAmount,
    paraMe,
    sort,
    page,
    pageSize: PAGE_SIZE,
    beneficiary,
    sourceLevel,
    territory,
    companyStage,
    legalForm,
    quality,
    hasOfficialDocs,
  })

  return Response.json(results satisfies SearchResponse)
}
