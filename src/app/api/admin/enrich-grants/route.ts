import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { enrichGrant } from '@/lib/grant-enrichment'

export async function POST() {
  try {
    const admin = createAdminClient()

    // Fetch grants that need enrichment (abierta or proxima, limit 200 per run)
    const { data: grants, error } = await admin
      .from('grants')
      .select('id, title, summary, organismo, budget_per_company_max, grant_type, scope, tags')
      .in('status', ['abierta', 'proxima'])
      .order('updated_at', { ascending: false })
      .limit(200)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!grants || grants.length === 0) {
      return NextResponse.json({ ok: true, stats: { total: 0, enriched: 0, failed: 0, durationMs: 0 } })
    }

    const start = Date.now()
    let enriched = 0
    let failed = 0
    const CHUNK = 10

    for (let i = 0; i < grants.length; i += CHUNK) {
      const chunk = grants.slice(i, i + CHUNK)
      await Promise.all(chunk.map(async (grant) => {
        try {
          const result = await enrichGrant({
            id: grant.id,
            title: grant.title,
            summary: grant.summary,
            organismo: grant.organismo,
            budget_per_company_max: grant.budget_per_company_max,
            grant_type: grant.grant_type,
            scope: grant.scope,
            tags: grant.tags ?? [],
          })
          await admin
            .from('grants')
            .update({ title: result.title, summary: result.summary })
            .eq('id', grant.id)
          enriched++
        } catch {
          failed++
        }
      }))
    }

    return NextResponse.json({
      ok: true,
      stats: { total: grants.length, enriched, failed, durationMs: Date.now() - start },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
