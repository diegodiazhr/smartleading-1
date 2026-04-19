import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Grant } from '@/lib/types'

export const dynamic = 'force-dynamic'

export interface GrantSearchResult extends Grant {
  eligibility_score?: number
  potential_amount_match?: number
}

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
  const from = page * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // Resolve company ID for this user
  let companyId: string | null = null
  const { data: userRecord } = await admin
    .from('users').select('organization_id').eq('id', user.id).single()
  if (userRecord?.organization_id) {
    const { data: co } = await admin
      .from('companies').select('id')
      .eq('organization_id', userRecord.organization_id).single()
    companyId = co?.id ?? null
  }

  // ── "Para mí" mode: query via company_grant_matches ──────────────────────
  if (paraMe && companyId) {
    let matchQuery = admin
      .from('company_grant_matches')
      .select('eligibility_score, potential_amount, grant:grants!inner(*)', { count: 'exact' })
      .eq('company_id', companyId)
      .gt('eligibility_score', 0) // exclude hard-excluded grants

    // Apply grant-level filters through the join
    if (status) matchQuery = matchQuery.eq('grant.status', status)
    if (scope) matchQuery = matchQuery.eq('grant.scope', scope)
    if (grantType) matchQuery = matchQuery.eq('grant.grant_type', grantType)
    if (minAmount > 0) matchQuery = matchQuery.gte('grant.budget_per_company_max', minAmount)

    // Text search on grant fields (applied client-side after fetch for simplicity
    // since PostgREST doesn't support ilike on embedded relations in all versions)
    if (sort === 'relevancia') {
      matchQuery = matchQuery.order('eligibility_score', { ascending: false })
    } else if (sort === 'deadline') {
      matchQuery = matchQuery.order('grant(deadline)', { ascending: true })
    } else if (sort === 'amount') {
      matchQuery = matchQuery.order('grant(budget_per_company_max)', { ascending: false })
    }

    // Fetch a larger batch when text search is active so we can filter & still get PAGE_SIZE results
    const fetchLimit = q ? PAGE_SIZE * 4 : PAGE_SIZE
    matchQuery = matchQuery.range(from, from + fetchLimit - 1)

    const { data: rows, count, error } = await matchQuery

    if (error) {
      return Response.json({ error: error.message }, { status: 500 })
    }

    type MatchRow = { eligibility_score: number; potential_amount: number | null; grant: Grant }
    let results = (rows as unknown as MatchRow[]) ?? []

    // Apply text search filter in-process (over the fetched batch)
    if (q) {
      const ql = normalizeText(q)
      results = results.filter(r => {
        const g = r.grant
        return (
          normalizeText(g.title).includes(ql) ||
          normalizeText(g.summary ?? '').includes(ql) ||
          normalizeText(g.organismo ?? '').includes(ql) ||
          (g.keywords ?? []).some((k: string) => normalizeText(k).includes(ql)) ||
          (g.tags ?? []).some((t: string) => normalizeText(t).includes(ql))
        )
      })
    }

    const sliced = results.slice(0, PAGE_SIZE)

    const grants: GrantSearchResult[] = sliced.map(r => ({
      ...(r.grant as Grant),
      eligibility_score: r.eligibility_score,
      potential_amount_match: r.potential_amount ?? undefined,
    }))

    return Response.json({
      grants,
      total: count ?? results.length,
      page,
      hasMore: (count ?? 0) > to + 1,
      matchCount: count ?? undefined,
    } satisfies SearchResponse)
  }

  // ── "Todas" mode: query grants directly ───────────────────────────────────
  let query = supabase
    .from('grants')
    .select('*', { count: 'exact' })

  // Text search — split into words for better recall
  if (q) {
    const terms = tokenize(q)
    if (terms.length === 1) {
      query = query.or(
        `title.ilike.%${terms[0]}%,summary.ilike.%${terms[0]}%,organismo.ilike.%${terms[0]}%`,
      )
    } else {
      // All terms must match somewhere across title | summary | organismo
      for (const term of terms) {
        query = query.or(
          `title.ilike.%${term}%,summary.ilike.%${term}%,organismo.ilike.%${term}%`,
        )
      }
    }
  }

  if (scope) query = query.eq('scope', scope)
  if (grantType) query = query.eq('grant_type', grantType)
  if (status) query = query.eq('status', status)
  if (minAmount > 0) query = query.gte('budget_per_company_max', minAmount)

  // Sorting
  if (sort === 'deadline') {
    query = query.order('deadline', { ascending: true })
  } else if (sort === 'amount') {
    query = query.order('budget_per_company_max', { ascending: false, nullsFirst: false })
  } else if (sort === 'difficulty') {
    query = query.order('difficulty_score', { ascending: true })
  } else {
    // Default: open grants first, then by deadline
    query = query.order('status', { ascending: true }).order('deadline', { ascending: true })
  }

  query = query.range(from, to)

  const { data: grants, count, error } = await query

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  // Enrich with match scores if company is known
  let matchMap: Record<string, { eligibility_score: number; potential_amount: number | null }> = {}
  if (companyId && grants && grants.length > 0) {
    const grantIds = grants.map(g => g.id)
    const { data: matches } = await admin
      .from('company_grant_matches')
      .select('grant_id, eligibility_score, potential_amount')
      .eq('company_id', companyId)
      .in('grant_id', grantIds)

    for (const m of matches ?? []) {
      matchMap[m.grant_id] = { eligibility_score: m.eligibility_score, potential_amount: m.potential_amount }
    }
  }

  // "Todas" mode re-sorted by relevance when sort = 'relevancia'
  let results: GrantSearchResult[] = (grants ?? []).map(g => ({
    ...(g as Grant),
    eligibility_score: matchMap[g.id]?.eligibility_score,
    potential_amount_match: matchMap[g.id]?.potential_amount ?? undefined,
  }))

  if (sort === 'relevancia') {
    results = results.sort((a, b) => (b.eligibility_score ?? 0) - (a.eligibility_score ?? 0))
  }

  // Get total matched count for badge
  let matchCount: number | undefined
  if (companyId) {
    const { count: mc } = await admin
      .from('company_grant_matches')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .gte('eligibility_score', 40)
    matchCount = mc ?? undefined
  }

  return Response.json({
    grants: results,
    total: count ?? 0,
    page,
    hasMore: (count ?? 0) > to + 1,
    matchCount,
  } satisfies SearchResponse)
}

/** Normalize text for fuzzy client-side matching: lowercase + remove accents. */
function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

/** Split search query into up to 5 meaningful tokens, stripping stopwords. */
function tokenize(q: string): string[] {
  const stopwords = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'un', 'una', 'para', 'por', 'con', 'en', 'y', 'o'])
  return q
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/\s+/)
    .filter(t => t.length >= 3 && !stopwords.has(t))
    .slice(0, 5)
}
