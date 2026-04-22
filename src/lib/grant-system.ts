import { createAdminClient } from '@/lib/supabase/admin'
import { syncBDNS } from '@/lib/bdns-sync'
import { evaluateGrantQuality, type GrantQualityEvaluation, type GrantPublicationStatus } from '@/lib/grant-quality'
import type {
  GrantCall,
  GrantCallDocument,
  GrantEligibilityRule,
  GrantFieldEvidence,
  GrantFundingTerms,
  GrantIngestionRun,
  GrantPublisher,
  GrantSearchIndexRow,
  GrantSourceRecord,
  Json,
} from '@/lib/types'

type GrantSourceLevel = 'estado' | 'ccaa' | 'local' | 'ue'

interface GrantPublisherSeed {
  code: string
  name: string
  level: GrantSourceLevel
  territory: string
  authority_name: string
  kind: GrantPublisher['kind']
  parser_key: string
  discovery_url: string | null
  detail_url_pattern: string | null
  is_active: boolean
  priority: number
}

export interface GrantSystemLevelCoverage {
  level: GrantSourceLevel
  label: string
  configuredPublishers: number
  discoveredCalls: number
  publishedCalls: number
}

export interface GrantSystemPublisherSummary {
  publisher: GrantPublisher
  lastRun: GrantIngestionRun | null
  publishedRate: number | null
  errorRate: number | null
  totalRuns: number
}

export interface GrantSystemOverview {
  health: {
    activePublishers: number
    recentErrors: number
    averageLeadHours: number | null
    lastSyncByLevel: Record<GrantSourceLevel, { publisherName: string; status: GrantIngestionRun['status']; finishedAt: string | null } | null>
  }
  coverage: GrantSystemLevelCoverage[]
  funnel: {
    discovered: number
    fetched: number
    enriched: number
    published: number
    rejected: number
  }
  queues: {
    pendingEnrichment: number
    pendingReview: number
    extractionFailures: number
    withoutPrimarySource: number
  }
  riskCalls: Array<{
    id: string
    title: string
    publicationStatus: GrantPublicationStatus
    qualityScore: number
    source: string
    scope: string
    updatedAt: string
    hasPrimarySource: boolean
  }>
}

export interface GrantPipelineCallDetail {
  call: GrantCall
  program: {
    id: string | null
    title: string | null
    first_seen_at: string | null
    last_seen_at: string | null
    source_url: string | null
  } | null
  discovery: {
    publisher: GrantPublisher | null
    externalIds: string[]
    dedupeKey: string | null
    firstDetectedAt: string | null
    lastDetectedAt: string | null
  }
  preferredSourceRecord: GrantSourceRecord | null
  sourceRecords: GrantSourceRecord[]
  documents: GrantCallDocument[]
  eligibility: GrantEligibilityRule | null
  funding: GrantFundingTerms | null
  documentRequirements: Array<{ name: string; phase: string; is_required: boolean; notes: string | null }>
  expenseRules: Array<{ expense_type: string; is_eligible: boolean; notes: string | null }>
  evidence: Array<GrantFieldEvidence & { sourceLabel: string | null }>
  quality: GrantQualityEvaluation
  preview: GrantSearchIndexRow | null
}

export interface SyncGrantSourcesOptions {
  publisherCodes?: string[]
  maxPagesPerVpd?: number
  pageSize?: number
  persistArtifacts?: boolean
  fetchSourceDocuments?: boolean
  force?: boolean
}

export interface SyncGrantSourcesResult {
  startedAt: string
  finishedAt: string
  totals: {
    publishers: number
    discovered: number
    fetched: number
    enriched: number
    published: number
    rejected: number
  }
  runs: Array<{
    publisherCode: string
    publisherName: string
    status: GrantIngestionRun['status']
    discoveredCount: number
    fetchedCount: number
    enrichedCount: number
    publishedCount: number
    rejectedCount: number
    errorSummary: string | null
  }>
}

interface GrantCallDetailRow extends GrantCall {
  grant_programs?: {
    id: string
    title: string
    first_seen_at: string
    last_seen_at: string
    source_url: string | null
  } | null
  grant_source_records?: GrantSourceRecord[] | null
  grant_call_documents?: GrantCallDocument[] | null
  grant_eligibility_rules?: GrantEligibilityRule[] | null
  grant_funding_terms?: GrantFundingTerms[] | null
  grant_document_requirements?: Array<{ name: string; phase: string; is_required: boolean; notes: string | null }> | null
  grant_expense_rules?: Array<{ expense_type: string; is_eligible: boolean; notes: string | null }> | null
  grant_field_evidence?: GrantFieldEvidence[] | null
}

const SPANISH_AUTONOMOUS_COMMUNITIES = [
  'Andalucía',
  'Aragón',
  'Asturias',
  'Illes Balears',
  'Canarias',
  'Cantabria',
  'Castilla-La Mancha',
  'Castilla y León',
  'Cataluña',
  'Comunitat Valenciana',
  'Extremadura',
  'Galicia',
  'Comunidad de Madrid',
  'Región de Murcia',
  'Navarra',
  'País Vasco',
  'La Rioja',
]

const PUBLISHER_SEEDS: GrantPublisherSeed[] = [
  {
    code: 'bdns',
    name: 'BDNS / Sistema Nacional de Publicidad de Subvenciones',
    level: 'estado',
    territory: 'España',
    authority_name: 'Intervención General de la Administración del Estado',
    kind: 'api',
    parser_key: 'bdns_api',
    discovery_url: 'https://www.infosubvenciones.es/bdnstrans/GE/es/convocatorias',
    detail_url_pattern: 'https://www.infosubvenciones.es/bdnstrans/GE/es/convocatorias',
    is_active: true,
    priority: 100,
  },
  {
    code: 'boe',
    name: 'BOE Ayudas y Subvenciones',
    level: 'estado',
    territory: 'España',
    authority_name: 'Boletín Oficial del Estado',
    kind: 'portal',
    parser_key: 'boe_ayudas',
    discovery_url: 'https://www.boe.es/buscar/ayudas.php',
    detail_url_pattern: 'https://www.boe.es/',
    is_active: true,
    priority: 95,
  },
  {
    code: 'cdti',
    name: 'CDTI Innovación',
    level: 'estado',
    territory: 'España',
    authority_name: 'CDTI',
    kind: 'portal',
    parser_key: 'cdti_calls',
    discovery_url: null,
    detail_url_pattern: null,
    is_active: true,
    priority: 92,
  },
  {
    code: 'enisa',
    name: 'ENISA',
    level: 'estado',
    territory: 'España',
    authority_name: 'ENISA',
    kind: 'portal',
    parser_key: 'enisa_calls',
    discovery_url: null,
    detail_url_pattern: null,
    is_active: true,
    priority: 90,
  },
  {
    code: 'icex',
    name: 'ICEX',
    level: 'estado',
    territory: 'España',
    authority_name: 'ICEX España Exportación e Inversiones',
    kind: 'portal',
    parser_key: 'icex_calls',
    discovery_url: null,
    detail_url_pattern: null,
    is_active: true,
    priority: 88,
  },
  {
    code: 'redes',
    name: 'Red.es',
    level: 'estado',
    territory: 'España',
    authority_name: 'Red.es',
    kind: 'portal',
    parser_key: 'redes_calls',
    discovery_url: null,
    detail_url_pattern: null,
    is_active: true,
    priority: 85,
  },
  {
    code: 'ccaa',
    name: 'Red de portales autonómicos',
    level: 'ccaa',
    territory: 'España autonómica',
    authority_name: 'Comunidades Autónomas',
    kind: 'portal',
    parser_key: 'ccaa_network',
    discovery_url: null,
    detail_url_pattern: null,
    is_active: true,
    priority: 84,
  },
  ...SPANISH_AUTONOMOUS_COMMUNITIES.map((territory, index) => ({
    code: `ccaa-${territory.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}`,
    name: `Portal oficial de ayudas · ${territory}`,
    level: 'ccaa' as const,
    territory,
    authority_name: territory,
    kind: 'portal' as const,
    parser_key: 'ccaa_portal',
    discovery_url: null,
    detail_url_pattern: null,
    is_active: true,
    priority: 80 - index,
  })),
  {
    code: 'municipal',
    name: 'Red BOP / boletines provinciales',
    level: 'local',
    territory: 'España local',
    authority_name: 'Boletines oficiales provinciales',
    kind: 'portal',
    parser_key: 'local_bop_network',
    discovery_url: null,
    detail_url_pattern: null,
    is_active: true,
    priority: 78,
  },
  {
    code: 'local-madrid',
    name: 'Ayuntamiento de Madrid',
    level: 'local',
    territory: 'Madrid',
    authority_name: 'Ayuntamiento de Madrid',
    kind: 'portal',
    parser_key: 'local_city_portal',
    discovery_url: null,
    detail_url_pattern: null,
    is_active: true,
    priority: 76,
  },
  {
    code: 'local-barcelona',
    name: 'Ajuntament de Barcelona',
    level: 'local',
    territory: 'Barcelona',
    authority_name: 'Ajuntament de Barcelona',
    kind: 'portal',
    parser_key: 'local_city_portal',
    discovery_url: null,
    detail_url_pattern: null,
    is_active: true,
    priority: 75,
  },
  {
    code: 'local-valencia',
    name: 'Ajuntament de València',
    level: 'local',
    territory: 'Valencia',
    authority_name: 'Ajuntament de València',
    kind: 'portal',
    parser_key: 'local_city_portal',
    discovery_url: null,
    detail_url_pattern: null,
    is_active: true,
    priority: 74,
  },
  {
    code: 'local-sevilla',
    name: 'Ayuntamiento de Sevilla',
    level: 'local',
    territory: 'Sevilla',
    authority_name: 'Ayuntamiento de Sevilla',
    kind: 'portal',
    parser_key: 'local_city_portal',
    discovery_url: null,
    detail_url_pattern: null,
    is_active: true,
    priority: 73,
  },
  {
    code: 'local-malaga',
    name: 'Ayuntamiento de Málaga',
    level: 'local',
    territory: 'Málaga',
    authority_name: 'Ayuntamiento de Málaga',
    kind: 'portal',
    parser_key: 'local_city_portal',
    discovery_url: null,
    detail_url_pattern: null,
    is_active: true,
    priority: 72,
  },
  {
    code: 'local-zaragoza',
    name: 'Ayuntamiento de Zaragoza',
    level: 'local',
    territory: 'Zaragoza',
    authority_name: 'Ayuntamiento de Zaragoza',
    kind: 'portal',
    parser_key: 'local_city_portal',
    discovery_url: null,
    detail_url_pattern: null,
    is_active: true,
    priority: 71,
  },
  {
    code: 'local-bilbao',
    name: 'Ayuntamiento de Bilbao',
    level: 'local',
    territory: 'Bilbao',
    authority_name: 'Ayuntamiento de Bilbao',
    kind: 'portal',
    parser_key: 'local_city_portal',
    discovery_url: null,
    detail_url_pattern: null,
    is_active: true,
    priority: 70,
  },
  {
    code: 'doue',
    name: 'Funding & Tenders / DOUE',
    level: 'ue',
    territory: 'Unión Europea',
    authority_name: 'European Commission',
    kind: 'portal',
    parser_key: 'eu_funding_tenders',
    discovery_url: 'https://commission.europa.eu/live-work-travel-eu/funding-opportunities_en',
    detail_url_pattern: 'https://ec.europa.eu/info/funding-tenders/opportunities/portal/',
    is_active: true,
    priority: 98,
  },
  {
    code: 'eic',
    name: 'European Innovation Council',
    level: 'ue',
    territory: 'Unión Europea',
    authority_name: 'European Innovation Council',
    kind: 'portal',
    parser_key: 'eu_eic_calls',
    discovery_url: null,
    detail_url_pattern: null,
    is_active: true,
    priority: 89,
  },
]

function levelLabel(level: GrantSourceLevel) {
  const labels: Record<GrantSourceLevel, string> = {
    estado: 'Estado',
    ccaa: 'CCAA',
    local: 'Local',
    ue: 'UE',
  }
  return labels[level]
}

function sourceLevelFromScope(scope: string): GrantSourceLevel {
  switch (scope) {
    case 'autonomico':
      return 'ccaa'
    case 'municipal':
      return 'local'
    case 'europeo':
      return 'ue'
    default:
      return 'estado'
  }
}

function average(values: number[]) {
  if (values.length === 0) return null
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1))
}

function asArray<T>(value: T[] | null | undefined) {
  return value ?? []
}

function asJsonObject(value: Json): Record<string, Json> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, Json>
  }
  return {}
}

function readExternalId(metadata: Json) {
  const object = asJsonObject(metadata)
  const value = object.external_id
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function countStructuredRequirements(rule: GrantEligibilityRule | null, documentRequirements: Array<{ name: string }> = []) {
  const rawRules = asJsonObject(rule?.raw_rules ?? {})
  const requirementsValue = rawRules.requirements
  const arrayCount = Array.isArray(requirementsValue) ? requirementsValue.length : 0
  return Math.max(arrayCount, documentRequirements.length)
}

async function getPublisherByCode(code: string) {
  const admin = createAdminClient()
  const { data } = await admin
    .from('grant_publishers')
    .select('*')
    .eq('code', code)
    .maybeSingle()

  return (data ?? null) as GrantPublisher | null
}

async function getPublishedAndRejectedCountsForSource(source: string, since: string) {
  const admin = createAdminClient()
  const [{ count: published }, { count: rejected }] = await Promise.all([
    admin
      .from('grant_calls')
      .select('id', { count: 'exact', head: true })
      .eq('source', source)
      .gte('updated_at', since)
      .eq('publication_status', 'published'),
    admin
      .from('grant_calls')
      .select('id', { count: 'exact', head: true })
      .eq('source', source)
      .gte('updated_at', since)
      .eq('publication_status', 'rejected'),
  ])

  return {
    published: published ?? 0,
    rejected: rejected ?? 0,
  }
}

export async function ensureGrantPublishersSeeded() {
  const admin = createAdminClient()
  await admin.from('grant_publishers').upsert(PUBLISHER_SEEDS, { onConflict: 'code' })
}

export async function runGrantPublisherSync(
  publisherCode: string,
  execute: (context: { publisher: GrantPublisher; startedAt: string }) => Promise<{
    status?: GrantIngestionRun['status']
    cursor?: string | null
    discoveredCount?: number
    fetchedCount?: number
    enrichedCount?: number
    publishedCount?: number
    rejectedCount?: number
    errorSummary?: string | null
    metadata?: Json
  }>,
) {
  await ensureGrantPublishersSeeded()
  const admin = createAdminClient()
  const publisher = await getPublisherByCode(publisherCode)

  if (!publisher) {
    throw new Error(`Publisher ${publisherCode} no configurado`)
  }

  const startedAt = new Date().toISOString()
  const { data: insertedRun, error: insertError } = await admin
    .from('grant_ingestion_runs')
    .insert({
      publisher_id: publisher.id,
      status: 'running',
      started_at: startedAt,
      metadata: { publisher_code: publisher.code },
    })
    .select('id')
    .single()

  if (insertError) {
    throw new Error(insertError.message)
  }

  try {
    const result = await execute({ publisher, startedAt })
    const finishedAt = new Date().toISOString()
    const payload = {
      status: result.status ?? 'success',
      finished_at: finishedAt,
      cursor: result.cursor ?? null,
      discovered_count: result.discoveredCount ?? 0,
      fetched_count: result.fetchedCount ?? 0,
      enriched_count: result.enrichedCount ?? 0,
      published_count: result.publishedCount ?? 0,
      rejected_count: result.rejectedCount ?? 0,
      error_summary: result.errorSummary ?? null,
      metadata: result.metadata ?? {},
    }

    const { error: updateError } = await admin
      .from('grant_ingestion_runs')
      .update(payload)
      .eq('id', insertedRun.id)

    if (updateError) {
      throw new Error(updateError.message)
    }

    return {
      runId: insertedRun.id,
      publisher,
      startedAt,
      finishedAt,
      ...payload,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown_error'
    await admin
      .from('grant_ingestion_runs')
      .update({
        status: 'error',
        finished_at: new Date().toISOString(),
        error_summary: message,
        metadata: { publisher_code: publisher.code },
      })
      .eq('id', insertedRun.id)
    throw error
  }
}

export async function syncGrantSources(options: SyncGrantSourcesOptions = {}): Promise<SyncGrantSourcesResult> {
  await ensureGrantPublishersSeeded()
  const admin = createAdminClient()
  const { data: publishers } = await admin
    .from('grant_publishers')
    .select('*')
    .eq('is_active', true)
    .order('priority', { ascending: false })

  const scopedPublishers = (publishers ?? [])
    .filter(publisher => !options.publisherCodes || options.publisherCodes.includes(publisher.code)) as GrantPublisher[]

  const startedAt = new Date().toISOString()
  const runs: SyncGrantSourcesResult['runs'] = []

  for (const publisher of scopedPublishers) {
    if (publisher.code === 'bdns') {
      const result = await runGrantPublisherSync('bdns', async ({ startedAt: runStartedAt }) => {
        const stats = await syncBDNS({
          maxPagesPerVpd: options.maxPagesPerVpd,
          pageSize: options.pageSize,
          persistArtifacts: options.persistArtifacts,
          fetchSourceDocuments: options.fetchSourceDocuments,
        })
        const publicationCounts = await getPublishedAndRejectedCountsForSource('bdns', runStartedAt)
        return {
          status: 'success',
          discoveredCount: stats.totalGrantsUpserted,
          fetchedCount: stats.totalGrantsUpserted,
          enrichedCount: stats.totalGrantsUpserted,
          publishedCount: publicationCounts.published,
          rejectedCount: publicationCounts.rejected,
          metadata: {
            totalPagesProcessed: stats.totalPagesProcessed,
            durationMs: stats.durationMs,
          },
        }
      })

      runs.push({
        publisherCode: publisher.code,
        publisherName: publisher.name,
        status: result.status,
        discoveredCount: result.discovered_count,
        fetchedCount: result.fetched_count,
        enrichedCount: result.enriched_count,
        publishedCount: result.published_count,
        rejectedCount: result.rejected_count,
        errorSummary: result.error_summary,
      })
      continue
    }

    const result = await runGrantPublisherSync(publisher.code, async () => ({
      status: 'skipped',
      errorSummary: null,
      metadata: {
        reason: 'adapter_not_implemented_yet',
        force: options.force ?? false,
      },
    }))

    runs.push({
      publisherCode: publisher.code,
      publisherName: publisher.name,
      status: result.status,
      discoveredCount: result.discovered_count,
      fetchedCount: result.fetched_count,
      enrichedCount: result.enriched_count,
      publishedCount: result.published_count,
      rejectedCount: result.rejected_count,
      errorSummary: result.error_summary,
    })
  }

  const finishedAt = new Date().toISOString()
  return {
    startedAt,
    finishedAt,
    totals: {
      publishers: runs.length,
      discovered: runs.reduce((sum, item) => sum + item.discoveredCount, 0),
      fetched: runs.reduce((sum, item) => sum + item.fetchedCount, 0),
      enriched: runs.reduce((sum, item) => sum + item.enrichedCount, 0),
      published: runs.reduce((sum, item) => sum + item.publishedCount, 0),
      rejected: runs.reduce((sum, item) => sum + item.rejectedCount, 0),
    },
    runs,
  }
}

export async function getGrantSystemPublishers(): Promise<GrantSystemPublisherSummary[]> {
  await ensureGrantPublishersSeeded()
  const admin = createAdminClient()
  const [{ data: publishers }, { data: runs }] = await Promise.all([
    admin.from('grant_publishers').select('*').order('priority', { ascending: false }),
    admin.from('grant_ingestion_runs').select('*').order('started_at', { ascending: false }).limit(500),
  ])

  const runsByPublisher = new Map<string, GrantIngestionRun[]>()
  for (const run of (runs ?? []) as GrantIngestionRun[]) {
    const list = runsByPublisher.get(run.publisher_id) ?? []
    list.push(run)
    runsByPublisher.set(run.publisher_id, list)
  }

  return ((publishers ?? []) as GrantPublisher[]).map(publisher => {
    const publisherRuns = runsByPublisher.get(publisher.id) ?? []
    const lastRun = publisherRuns[0] ?? null
    const totalRuns = publisherRuns.length
    const errorRuns = publisherRuns.filter(run => run.status === 'error').length
    const successfulRuns = publisherRuns.filter(run => ['success', 'partial'].includes(run.status))
    const discoveredTotal = successfulRuns.reduce((sum, run) => sum + run.discovered_count, 0)
    const publishedTotal = successfulRuns.reduce((sum, run) => sum + run.published_count, 0)

    return {
      publisher,
      lastRun,
      publishedRate: discoveredTotal > 0 ? Number(((publishedTotal / discoveredTotal) * 100).toFixed(1)) : null,
      errorRate: totalRuns > 0 ? Number(((errorRuns / totalRuns) * 100).toFixed(1)) : null,
      totalRuns,
    }
  })
}

export async function getGrantSystemOverview(): Promise<GrantSystemOverview> {
  const admin = createAdminClient()
  const [publishers, callsResponse, runsResponse, sourceRecordsResponse] = await Promise.all([
    getGrantSystemPublishers(),
    admin
      .from('grant_calls')
      .select('id, title, scope, source, publication_status, quality_score, preferred_detail_source_record_id, updated_at, created_at, last_enriched_at')
      .order('updated_at', { ascending: false }),
    admin
      .from('grant_ingestion_runs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(500),
    admin
      .from('grant_source_records')
      .select('grant_call_id')
      .limit(5000),
  ])

  const calls = (callsResponse.data ?? []) as Array<Pick<GrantCall, 'id' | 'title' | 'scope' | 'source' | 'publication_status' | 'quality_score' | 'preferred_detail_source_record_id' | 'updated_at' | 'created_at' | 'last_enriched_at'>>
  const runs = (runsResponse.data ?? []) as GrantIngestionRun[]
  const fetchedCallIds = new Set((sourceRecordsResponse.data ?? []).map(record => record.grant_call_id).filter(Boolean))

  const lastSyncByLevel: GrantSystemOverview['health']['lastSyncByLevel'] = {
    estado: null,
    ccaa: null,
    local: null,
    ue: null,
  }

  for (const level of ['estado', 'ccaa', 'local', 'ue'] as GrantSourceLevel[]) {
    const levelPublisherIds = new Set(
      publishers
        .filter(item => item.publisher.level === level)
        .map(item => item.publisher.id),
    )
    const latestRun = runs.find(run => levelPublisherIds.has(run.publisher_id))
    if (latestRun) {
      const publisher = publishers.find(item => item.publisher.id === latestRun.publisher_id)?.publisher
      lastSyncByLevel[level] = {
        publisherName: publisher?.name ?? 'Fuente oficial',
        status: latestRun.status,
        finishedAt: latestRun.finished_at,
      }
    }
  }

  const recentErrorThreshold = Date.now() - (7 * 24 * 60 * 60 * 1000)
  const recentErrors = runs.filter(run =>
    run.status === 'error' &&
    new Date(run.started_at).getTime() >= recentErrorThreshold,
  ).length

  const leadTimes = calls
    .filter(call => call.publication_status === 'published' && call.last_enriched_at)
    .map(call => {
      const started = new Date(call.created_at).getTime()
      const finished = new Date(call.last_enriched_at as string).getTime()
      return Number.isFinite(started) && Number.isFinite(finished) && finished >= started
        ? (finished - started) / (1000 * 60 * 60)
        : null
    })
    .filter((value): value is number => value !== null)

  const coverage = (['estado', 'ccaa', 'local', 'ue'] as GrantSourceLevel[]).map(level => {
    const matchingCalls = calls.filter(call => sourceLevelFromScope(call.scope) === level)
    return {
      level,
      label: levelLabel(level),
      configuredPublishers: publishers.filter(item => item.publisher.level === level).length,
      discoveredCalls: matchingCalls.length,
      publishedCalls: matchingCalls.filter(call => call.publication_status === 'published').length,
    }
  })

  return {
    health: {
      activePublishers: publishers.filter(item => item.publisher.is_active).length,
      recentErrors,
      averageLeadHours: average(leadTimes),
      lastSyncByLevel,
    },
    coverage,
    funnel: {
      discovered: calls.length,
      fetched: fetchedCallIds.size,
      enriched: calls.filter(call => ['enriched', 'published'].includes(call.publication_status)).length,
      published: calls.filter(call => call.publication_status === 'published').length,
      rejected: calls.filter(call => call.publication_status === 'rejected').length,
    },
    queues: {
      pendingEnrichment: calls.filter(call => call.publication_status === 'draft').length,
      pendingReview: calls.filter(call => call.publication_status === 'enriched').length,
      extractionFailures: calls.filter(call => call.publication_status === 'rejected').length,
      withoutPrimarySource: calls.filter(call => !call.preferred_detail_source_record_id).length,
    },
    riskCalls: calls
      .filter(call => call.publication_status !== 'published' || !call.preferred_detail_source_record_id)
      .slice(0, 8)
      .map(call => ({
        id: call.id,
        title: call.title,
        publicationStatus: call.publication_status,
        qualityScore: Number(call.quality_score ?? 0),
        source: call.source,
        scope: call.scope,
        updatedAt: call.updated_at,
        hasPrimarySource: Boolean(call.preferred_detail_source_record_id),
      })),
  }
}

export async function getGrantPipelineCallDetail(callId: string): Promise<GrantPipelineCallDetail | null> {
  await ensureGrantPublishersSeeded()
  const admin = createAdminClient()

  const [{ data: callData }, { data: previewData }] = await Promise.all([
    admin
      .from('grant_calls')
      .select(`
        *,
        grant_programs(id, title, first_seen_at, last_seen_at, source_url),
        grant_source_records(*),
        grant_call_documents(*),
        grant_eligibility_rules(*),
        grant_funding_terms(*),
        grant_document_requirements(name, phase, is_required, notes),
        grant_expense_rules(expense_type, is_eligible, notes),
        grant_field_evidence(*)
      `)
      .eq('id', callId)
      .maybeSingle(),
    admin
      .from('grant_search_index')
      .select('*')
      .eq('grant_call_id', callId)
      .maybeSingle(),
  ])

  if (!callData) return null

  const call = callData as unknown as GrantCallDetailRow
  const sourceRecords = [...asArray(call.grant_source_records)].sort((a, b) => (
    new Date(b.fetched_at).getTime() - new Date(a.fetched_at).getTime()
  ))
  const documents = [...asArray(call.grant_call_documents)].sort((a, b) => (
    Number(b.is_primary) - Number(a.is_primary) ||
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  ))
  const eligibility = asArray(call.grant_eligibility_rules)[0] ?? null
  const funding = asArray(call.grant_funding_terms)[0] ?? null
  const documentRequirements = asArray(call.grant_document_requirements)
  const expenseRules = asArray(call.grant_expense_rules)
  const evidence = asArray(call.grant_field_evidence)
  const preferredSourceRecord = sourceRecords.find(record => record.id === call.preferred_detail_source_record_id) ?? null

  const sourceCodes = [...new Set([call.source, ...sourceRecords.map(record => record.source)].filter(Boolean))]
  const { data: publishers } = await admin
    .from('grant_publishers')
    .select('*')
    .in('code', sourceCodes)

  const publisherMap = new Map<string, GrantPublisher>(
    ((publishers ?? []) as GrantPublisher[]).map(publisher => [publisher.code, publisher]),
  )

  const requirementCount = countStructuredRequirements(eligibility, documentRequirements)
  const quality = evaluateGrantQuality({
    title: call.title,
    summary: call.summary,
    officialSourceUrl: preferredSourceRecord?.source_url ?? documents[0]?.url ?? call.source_url,
    beneficiaryTypes: eligibility?.beneficiary_types ?? [],
    requirementsCount: requirementCount,
    hasFunding: Boolean(
      funding?.budget_total !== null ||
      funding?.budget_per_company_min !== null ||
      funding?.budget_per_company_max !== null ||
      funding?.grant_intensity_percent !== null
    ),
    hasTimeline: Boolean(call.deadline || call.opening_date || ['abierta', 'proxima'].includes(call.status)),
    evidenceCount: evidence.filter(item => (item.confidence ?? 0) >= 0.5 && item.evidence_text).length,
    hasPrimaryDocument: documents.some(document => document.is_primary),
    hasSourceRecord: sourceRecords.length > 0,
  })

  const firstDetectedCandidates = [
    call.grant_programs?.first_seen_at,
    ...sourceRecords.map(record => record.created_at),
  ].filter(Boolean) as string[]
  const lastDetectedCandidates = [
    call.grant_programs?.last_seen_at,
    ...sourceRecords.map(record => record.fetched_at),
    call.updated_at,
  ].filter(Boolean) as string[]

  const documentBySourceRecordId = new Map(
    documents
      .filter(document => document.source_record_id)
      .map(document => [document.source_record_id as string, document]),
  )

  return {
    call: {
      ...call,
      quality_score: Number(call.quality_score ?? quality.qualityScore),
      detail_completeness: Number(call.detail_completeness ?? quality.detailCompleteness),
      publication_status: call.publication_status ?? quality.publicationStatus,
    },
    program: call.grant_programs ?? null,
    discovery: {
      publisher: publisherMap.get(call.source) ?? null,
      externalIds: [...new Set([
        call.external_id,
        ...sourceRecords.map(record => readExternalId(record.metadata)),
      ].filter(Boolean) as string[])],
      dedupeKey: call.dedupe_key,
      firstDetectedAt: firstDetectedCandidates.sort()[0] ?? null,
      lastDetectedAt: lastDetectedCandidates.sort().reverse()[0] ?? null,
    },
    preferredSourceRecord,
    sourceRecords,
    documents,
    eligibility,
    funding,
    documentRequirements,
    expenseRules,
    evidence: evidence.map(item => ({
      ...item,
      sourceLabel: documentBySourceRecordId.get(item.source_record_id ?? '')?.title
        ?? sourceRecords.find(record => record.id === item.source_record_id)?.source_url
        ?? item.source_url
        ?? null,
    })),
    quality,
    preview: (previewData ?? null) as GrantSearchIndexRow | null,
  }
}
