import { createHash } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchSourceDocumentSnapshot, persistGrantArtifacts, type CanonicalGrantInput } from '@/lib/grant-pipeline'
import type { GrantPublisher, Json } from '@/lib/types'

type SupportedPublisherCode = 'boe' | 'ccaa-comunidad-de-madrid' | 'local-madrid' | 'ccaa-andalucia' | 'ccaa-cataluna'
const IMPLEMENTED_PUBLISHER_CODES = ['bdns', 'boe', 'ccaa-comunidad-de-madrid', 'local-madrid', 'ccaa-andalucia', 'ccaa-cataluna'] as const

interface HtmlPage {
  url: string
  html: string
  lines: string[]
  text: string
}

interface AnchorLink {
  href: string
  text: string
}

interface DiscoveryEntry {
  sourceCode: SupportedPublisherCode
  externalId: string
  detailUrl: string
  titleHint?: string | null
}

interface ParsedGrantRecord {
  externalId: string
  title: string
  summary: string | null
  body: string | null
  organismo: string | null
  sourceUrl: string
  publicationDate: string | null
  openingDate: string | null
  deadline: string | null
  status: CanonicalGrantInput['status']
  grantType: CanonicalGrantInput['grantType']
  scope: CanonicalGrantInput['scope']
  regions: string[]
  sectors: string[]
  cnaeCodes: string[]
  tags: string[]
  budgetTotal: number | null
  budgetPerCompanyMin: number | null
  budgetPerCompanyMax: number | null
  minEmployees: number | null
  maxEmployees: number | null
  minRevenue: number | null
  maxRevenue: number | null
  minCompanyAgeYears: number | null
  requirements: string[]
  eligibleExpenses: string[]
  requiredDocuments: string[]
  rawText: string
  detailJson: Json
}

interface SyncPublisherStats {
  discoveredCount: number
  fetchedCount: number
  enrichedCount: number
  publishedCount: number
  rejectedCount: number
  errors: string[]
}

const BUSINESS_POSITIVE_PATTERN = /\b(empresa|empresas|pyme|pymes|startup|aut[oó]nom|cooperativ|cl[uú]ster|industria|industrial|comercio|comercial|hosteler|hotelero|exportaci[oó]n|internacionaliz|innovaci[oó]n|digitalizaci[oó]n|mercados municipales)\b/i
const BUSINESS_NEGATIVE_PATTERN = /\b(v[ií]ctimas|guerra|dictadura|federaciones deportivas|t[ií]tulo universitario|accidentes de tr[aá]fico|estudiante|universitario)\b/i

const SPANISH_MONTHS: Record<string, number> = {
  enero: 1,
  february: 2,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  setiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
  gener: 1,
  febrer: 2,
  marc: 3,
  març: 3,
  abrilca: 4,
  maig: 5,
  juny: 6,
  juliol: 7,
  agost: 8,
  setembre: 9,
  octubreca: 10,
  novembre: 11,
  desembre: 12,
}

const MADRID_DISCOVERY_URL = 'https://www.madrid.es/portales/munimadrid/es/Inicio/Actividad-economica-y-hacienda/Empresa-y-comercio/Ayudas-y-Subvenciones/?vgnextchannel=78da6d5ef88fe410VgnVCM1000000b205a0aRCRD&vgnextoid=4ecff2343378d610VgnVCM1000001d4a900aRCRD'
const BOE_DISCOVERY_URL = 'https://www.boe.es/buscar/ayudas.php'
const COMMUNITY_MADRID_DISCOVERY_URL = 'https://sede.comunidad.madrid/becas-ayudas-subvenciones/empresas/pymes'
const CATALONIA_DISCOVERY_URL = 'https://canalempresa.gencat.cat/ca/tramits-i-formularis/actualitat/ambits/financament/'
const ANDALUCIA_DISCOVERY_URLS = [
  'https://www.juntadeandalucia.es/organismos/universidadinvestigacioneinnovacion/areas/innovacion/ayudas-innovacion/innovandalucia-fomento-innovacion.html',
  'https://www.juntadeandalucia.es/temas/empresas/ayudas/internacionalizacion.html',
  'https://www.juntadeandalucia.es/organismos/empleoempresaytrabajoautonomo/areas/formacion-empleo/empresa-entidad-fpe/paginas/sub-compensacion-practicas-profesionales-2025.html',
]

function hash(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

function stableId(prefix: string, value: string) {
  const h = hash(`${prefix}:${value}`)
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`
}

function normalizeWhitespace(value: string | null | undefined) {
  return (value ?? '').replace(/\s+/g, ' ').trim()
}

function dedupeStrings(values: Array<string | null | undefined>) {
  return [...new Set(values.map(value => normalizeWhitespace(value)).filter(Boolean))]
}

function decodeEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&aacute;/gi, 'á')
    .replace(/&eacute;/gi, 'é')
    .replace(/&iacute;/gi, 'í')
    .replace(/&oacute;/gi, 'ó')
    .replace(/&uacute;/gi, 'ú')
    .replace(/&ntilde;/gi, 'ñ')
    .replace(/&ccedil;/gi, 'ç')
}

function htmlToLines(html: string) {
  const withBreaks = decodeEntities(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<(?:br|\/p|\/div|\/section|\/article|\/li|\/ul|\/ol|\/h[1-6]|\/tr|\/td|\/th)>/gi, '\n')
    .replace(/<(?:p|div|section|article|li|ul|ol|h[1-6]|tr|td|th)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')

  return withBreaks
    .split(/\n+/)
    .map(line => normalizeWhitespace(line.replace(/^[*·•\-]\s*/, '')))
    .filter(Boolean)
}

function extractAnchors(html: string, baseUrl: string) {
  const anchors: AnchorLink[] = []
  const regex = /<a\b[^>]*href=(?:"([^"]+)"|'([^']+)')[^>]*>([\s\S]*?)<\/a>/gi
  let match: RegExpExecArray | null

  while ((match = regex.exec(html))) {
    const href = match[1] ?? match[2]
    if (!href) continue

    const text = normalizeWhitespace(
      decodeEntities(match[3])
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' '),
    )

    try {
      anchors.push({
        href: new URL(href, baseUrl).toString(),
        text,
      })
    } catch {
      continue
    }
  }

  return anchors
}

async function fetchHtmlPage(url: string): Promise<HtmlPage> {
  const response = await fetch(url, {
    headers: {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'User-Agent': 'Mozilla/5.0 (compatible; SmartLeadingBot/1.0; +https://smartleading.app)',
    },
    cache: 'no-store',
    signal: AbortSignal.timeout(20000),
  })

  if (!response.ok) {
    throw new Error(`http_${response.status}`)
  }

  const html = await response.text()
  const lines = htmlToLines(html)
  return {
    url: response.url,
    html,
    lines,
    text: normalizeWhitespace(lines.join(' ')),
  }
}

function lineIndex(lines: string[], matcher: RegExp) {
  return lines.findIndex(line => matcher.test(line))
}

function sectionBetween(lines: string[], startMatchers: RegExp[], endMatchers: RegExp[]) {
  const startIndex = lines.findIndex(line => startMatchers.some(matcher => matcher.test(line)))
  if (startIndex === -1) return []

  const collected: string[] = []
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index]
    if (endMatchers.some(matcher => matcher.test(line))) break
    collected.push(line)
  }
  return collected
}

function parseNumber(value: string) {
  const normalized = value.replace(/\./g, '').replace(/,/g, '.')
  const parsed = Number.parseFloat(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function extractEuroAmounts(text: string) {
  const matches = [...text.matchAll(/(\d{1,3}(?:\.\d{3})*(?:,\d+)?|\d+(?:,\d+)?)\s*(?:euros|€)/gi)]
  return matches
    .map(match => parseNumber(match[1]))
    .filter((value): value is number => value !== null)
}

function extractBudgetTotal(text: string) {
  const contextual = text.match(/(?:cuant[ií]a total m[aá]xima|presupuesto(?: total)?|dotaci[oó]n(?: total)?|importe total)[^0-9]{0,40}(\d{1,3}(?:\.\d{3})*(?:,\d+)?|\d+(?:,\d+)?)\s*(?:euros|€)/i)
  if (contextual?.[1]) {
    return parseNumber(contextual[1])
  }
  return extractEuroAmounts(text)[0] ?? null
}

function extractBudgetPerCompanyMax(text: string) {
  const contextual = text.match(/(?:m[aá]ximo(?: de)?(?: subvenci[oó]n)?(?: por beneficiario)?|hasta el?|quantia m[aà]xima)[^0-9]{0,40}(\d{1,3}(?:\.\d{3})*(?:,\d+)?|\d+(?:,\d+)?)\s*(?:euros|€)/i)
  if (contextual?.[1]) {
    return parseNumber(contextual[1])
  }
  return null
}

function parseSlashDate(value: string) {
  const match = value.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (!match) return null
  const [, day, month, year] = match
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}

function normalizeMonth(rawMonth: string) {
  const month = rawMonth
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

  if (month === 'abril') return 4
  if (month === 'octubre') return 10
  return SPANISH_MONTHS[month] ?? null
}

function parseLongDate(value: string) {
  const match = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .match(/(\d{1,2})\s+d['e]?\s*([a-z]+)\s+de\s+(\d{4})|(\d{1,2})\s+de\s+([a-z]+)\s+de\s+(\d{4})/i)

  if (!match) return null
  const day = match[1] ?? match[4]
  const monthName = match[2] ?? match[5]
  const year = match[3] ?? match[6]
  const month = normalizeMonth(monthName)
  if (!day || !month || !year) return null
  return `${year}-${String(month).padStart(2, '0')}-${day.padStart(2, '0')}`
}

function findDates(text: string) {
  const slashMatches = [...text.matchAll(/\b\d{1,2}\/\d{1,2}\/\d{4}\b/g)].map(match => parseSlashDate(match[0])).filter(Boolean) as string[]
  const longMatches = [...text.matchAll(/\b\d{1,2}\s+(?:de|d['e]?)\s+[a-záéíóúàèìòùç]+(?:\s+de)?\s+\d{4}\b/gi)]
    .map(match => parseLongDate(match[0]))
    .filter(Boolean) as string[]
  return dedupeStrings([...slashMatches, ...longMatches])
}

function inferStatus(text: string, openingDate: string | null, deadline: string | null) {
  const lower = text.toLowerCase()
  if (/\bfuera de plazo\b|\bplazo cerrado\b|\bfinalizado\b|\bcerrad[oa]\b/.test(lower)) return 'cerrada' as const
  if (/\bplazo abierto\b|\babierto\b/.test(lower)) return 'abierta' as const

  const now = new Date().toISOString().slice(0, 10)
  if (openingDate && openingDate > now) return 'proxima' as const
  if (deadline && deadline < now) return 'cerrada' as const
  if (deadline && deadline >= now) return 'abierta' as const
  return 'abierta' as const
}

function inferGrantType(text: string): CanonicalGrantInput['grantType'] {
  const lower = text.toLowerCase()
  if (/aval|garant[ií]a/.test(lower)) return 'aval'
  if (/bonificaci[oó]n/.test(lower)) return 'bonificacion'
  if (/pr[eé]stamo|financiaci[oó]n reembolsable/.test(lower)) return 'prestamo'
  if (/mixto/.test(lower)) return 'mixto'
  return 'fondo_perdido'
}

function looksBusinessRelevant(title: string, text: string) {
  const haystack = `${title} ${text}`
  return BUSINESS_POSITIVE_PATTERN.test(haystack) && !BUSINESS_NEGATIVE_PATTERN.test(haystack)
}

function toJsonObject(value: Record<string, unknown>): Json {
  return value as unknown as Json
}

async function upsertLegacyGrant(sourceCode: string, record: ParsedGrantRecord) {
  const admin = createAdminClient()
  const { data: existing } = await admin
    .from('grants')
    .select('id')
    .eq('source', sourceCode)
    .eq('external_id', record.externalId)
    .maybeSingle()

  const grantId = existing?.id ?? stableId('grant', `${sourceCode}:${record.externalId}`)
  const payload = {
    id: grantId,
    external_id: record.externalId,
    title: record.title,
    body: record.body,
    organismo: record.organismo,
    source: sourceCode,
    source_url: record.sourceUrl,
    publication_date: record.publicationDate,
    opening_date: record.openingDate,
    deadline: record.deadline,
    budget_total: record.budgetTotal,
    budget_per_company_min: record.budgetPerCompanyMin,
    budget_per_company_max: record.budgetPerCompanyMax,
    grant_type: record.grantType,
    scope: record.scope,
    regions: record.regions,
    sectors: record.sectors,
    cnae_codes: record.cnaeCodes,
    min_employees: record.minEmployees,
    max_employees: record.maxEmployees,
    min_revenue: record.minRevenue,
    max_revenue: record.maxRevenue,
    min_company_age_years: record.minCompanyAgeYears,
    requirements: record.requirements,
    eligible_expenses: record.eligibleExpenses,
    required_documents: record.requiredDocuments,
    keywords: [],
    tags: record.tags,
    status: record.status,
    difficulty_score: record.requiredDocuments.length >= 6 ? 7 : 4,
    success_rate: null,
    summary: record.summary,
    raw_text: record.rawText,
  }

  const { error } = await admin
    .from('grants')
    .upsert(payload, { onConflict: 'source,external_id' })

  if (error) {
    throw new Error(error.message)
  }

  return grantId
}

function buildCanonicalInput(grantId: string, sourceCode: SupportedPublisherCode, record: ParsedGrantRecord): CanonicalGrantInput {
  return {
    grantId,
    externalId: record.externalId,
    title: record.title,
    summary: record.summary,
    body: record.body,
    organismo: record.organismo,
    source: sourceCode,
    sourceUrl: record.sourceUrl,
    publicationDate: record.publicationDate,
    openingDate: record.openingDate,
    deadline: record.deadline,
    status: record.status,
    grantType: record.grantType,
    scope: record.scope,
    regions: record.regions,
    sectors: record.sectors,
    cnaeCodes: record.cnaeCodes,
    tags: record.tags,
    budgetTotal: record.budgetTotal,
    budgetPerCompanyMin: record.budgetPerCompanyMin,
    budgetPerCompanyMax: record.budgetPerCompanyMax,
    minEmployees: record.minEmployees,
    maxEmployees: record.maxEmployees,
    minRevenue: record.minRevenue,
    maxRevenue: record.maxRevenue,
    minCompanyAgeYears: record.minCompanyAgeYears,
    requirements: record.requirements,
    eligibleExpenses: record.eligibleExpenses,
    requiredDocuments: record.requiredDocuments,
    rawText: record.rawText,
    detailJson: record.detailJson,
  }
}

function summaryFromLines(lines: string[], fallbackText: string) {
  const text = normalizeWhitespace(lines.slice(0, 4).join(' '))
  return text || normalizeWhitespace(fallbackText).slice(0, 420) || null
}

function tagsFromText(...texts: string[]) {
  const combined = texts.join(' ').toLowerCase()
  const tags: string[] = []
  if (/empresa|empresas|pyme|pymes/.test(combined)) tags.push('ben:empresa')
  if (/startup|emprendedor|emprendimiento/.test(combined)) tags.push('ben:startup')
  if (/aut[oó]nom/.test(combined)) tags.push('ben:autonomo')
  if (/cooperativ/.test(combined)) tags.push('ben:cooperativa')
  if (/cl[uú]ster/.test(combined)) tags.push('ben:cluster')
  if (/digital/.test(combined)) tags.push('digitalizacion')
  if (/innovaci[oó]n|i\+d/.test(combined)) tags.push('innovacion')
  if (/internacionaliz|exportaci[oó]n/.test(combined)) tags.push('internacionalizacion')
  if (/industr/.test(combined)) tags.push('industria')
  if (/comerc/.test(combined)) tags.push('comercio')
  if (/hosteler|hotel/.test(combined)) tags.push('hosteleria')
  return dedupeStrings(tags)
}

function cleanupSectionLines(lines: string[], maxItems = 8) {
  return dedupeStrings(lines)
    .filter(line => line.length > 8)
    .slice(0, maxItems)
}

async function discoverBoeEntries(limit: number) {
  const page = await fetchHtmlPage(BOE_DISCOVERY_URL)
  const links = extractAnchors(page.html, page.url)
  const detailLinks = links
    .filter(link => /boe\.es\/buscar\/doc\.php\?id=BOE-[A-Z]-\d{4}-\d+/i.test(link.href))
    .slice(0, limit)

  return detailLinks.map(link => {
    const externalId = link.href.match(/id=(BOE-[A-Z]-\d{4}-\d+)/i)?.[1] ?? stableId('boe-doc', link.href)
    return {
      sourceCode: 'boe' as const,
      externalId,
      detailUrl: link.href,
      titleHint: link.text,
    }
  })
}

async function discoverMadridEntries(limit: number) {
  const page = await fetchHtmlPage(MADRID_DISCOVERY_URL)
  const links = extractAnchors(page.html, page.url)
  return links
    .filter(link => /sede\.madrid\.es\/sites\/v\/index\.jsp/i.test(link.href))
    .filter(link => /convocatoria|subvenciones|ayudas/i.test(link.text))
    .slice(0, limit)
    .map(link => ({
      sourceCode: 'local-madrid' as const,
      externalId: stableId('madrid-ayuda', link.href),
      detailUrl: link.href,
      titleHint: link.text,
    }))
}

async function discoverCommunityMadridEntries(limit: number) {
  const page = await fetchHtmlPage(COMMUNITY_MADRID_DISCOVERY_URL)
  const links = extractAnchors(page.html, page.url)
  return links
    .filter(link => /sede\.comunidad\.madrid\/(?:ayudas-becas-subvenciones|node)\//i.test(link.href))
    .filter(link => /ayudas?|subvenci[oó]n|cheque|pymes|empresas/i.test(link.text))
    .slice(0, limit)
    .map(link => ({
      sourceCode: 'ccaa-comunidad-de-madrid' as const,
      externalId: stableId('comunidad-madrid-ayuda', link.href),
      detailUrl: link.href,
      titleHint: link.text,
    }))
}

async function discoverCataloniaEntries(limit: number) {
  const page = await fetchHtmlPage(CATALONIA_DISCOVERY_URL)
  const links = extractAnchors(page.html, page.url)
  return links
    .filter(link => /canalempresa\.gencat\.cat\/ca\/integraciodepartamentaltramit\/tramit\/PerTemes\//i.test(link.href))
    .slice(0, limit)
    .map(link => ({
      sourceCode: 'ccaa-cataluna' as const,
      externalId: stableId('gencat-tramit', link.href),
      detailUrl: link.href,
      titleHint: link.text,
    }))
}

async function discoverAndaluciaEntries(limit: number) {
  return ANDALUCIA_DISCOVERY_URLS
    .slice(0, limit)
    .map(url => ({
      sourceCode: 'ccaa-andalucia' as const,
      externalId: stableId('andalucia-ayuda', url),
      detailUrl: url,
      titleHint: null,
    }))
}

function parseBoeGrant(page: HtmlPage, entry: DiscoveryEntry): ParsedGrantRecord | null {
  const title = normalizeWhitespace(
    page.lines[lineIndex(page.lines, /^Documento BOE-/i) + 1] ||
    page.lines.find(line => /Extracto|Orden|Resoluci[oó]n/i.test(line)) ||
    entry.titleHint,
  )

  const bodyStart = lineIndex(page.lines, /^TEXTO$/i)
  const bodyEnd = lineIndex(page.lines, /^AN[AÁ]LISIS$/i)
  const bodyLines = page.lines.slice(bodyStart + 1, bodyEnd === -1 ? undefined : bodyEnd)
  const bodyText = normalizeWhitespace(bodyLines.join(' '))

  if (!title || !looksBusinessRelevant(title, bodyText)) return null

  const publicationLine = page.lines.find(line => /BOE.*\d{4}/i.test(line)) ?? ''
  const publicationDate = findDates(publicationLine)[0] ?? null
  const organismoIndex = lineIndex(page.lines, /^Departamento:$/i)
  const organismo = organismoIndex >= 0 ? normalizeWhitespace(page.lines[organismoIndex + 1]) : null
  const beneficiaries = cleanupSectionLines(sectionBetween(bodyLines, [/beneficiari[ao]s?\.?$/i, /entidades beneficiarias\.?$/i], [/^(?:tercero|cuarto|quinto|sexto|septimo|séptimo)\./i]))
  const requirements = cleanupSectionLines([
    ...sectionBetween(bodyLines, [/requisitos/i], [/^(?:tercero|cuarto|quinto|sexto|septimo|séptimo)\./i]),
    ...beneficiaries,
  ])
  const summary = summaryFromLines(
    sectionBetween(bodyLines, [/objeto/i, /finalidad/i], [/^(?:segundo|tercero|cuarto)\./i]),
    bodyText,
  )
  const dates = findDates(bodyText)
  const deadline = bodyText.match(/finalizar[aá].*?\d{1,2}\/\d{1,2}\/\d{4}/i)
    ? findDates(bodyText.match(/finalizar[aá].*?\d{1,2}\/\d{1,2}\/\d{4}/i)?.[0] ?? '')[0] ?? null
    : dates[1] ?? null
  const budgetTotal = extractBudgetTotal(bodyText)
  const budgetPerCompanyMax = extractBudgetPerCompanyMax(bodyText)
  const externalId = bodyText.match(/BDNS\(Identif\.\):\s*(\d+)/i)?.[1] ?? entry.externalId

  return {
    externalId,
    title,
    summary,
    body: bodyText,
    organismo,
    sourceUrl: page.url,
    publicationDate,
    openingDate: publicationDate,
    deadline,
    status: inferStatus(bodyText, publicationDate, deadline),
    grantType: inferGrantType(bodyText),
    scope: 'nacional',
    regions: ['España'],
    sectors: dedupeStrings([
      /industr/i.test(bodyText) ? 'industria' : null,
      /digital/i.test(bodyText) ? 'digitalización' : null,
      /export/i.test(bodyText) ? 'internacionalización' : null,
    ]),
    cnaeCodes: [],
    tags: tagsFromText(title, bodyText, beneficiaries.join(' ')),
    budgetTotal,
    budgetPerCompanyMin: null,
    budgetPerCompanyMax,
    minEmployees: null,
    maxEmployees: null,
    minRevenue: null,
    maxRevenue: null,
    minCompanyAgeYears: null,
    requirements,
    eligibleExpenses: cleanupSectionLines(sectionBetween(bodyLines, [/actuaciones financiadas/i, /proyectos subvencionables/i], [/^(?:sexto|septimo|séptimo)\./i])),
    requiredDocuments: [],
    rawText: bodyText,
    detailJson: toJsonObject({
      source: 'boe',
      publication_line: publicationLine,
      beneficiaries,
      parsed_dates: dates,
    }),
  }
}

function parseMadridGrant(page: HtmlPage, entry: DiscoveryEntry): ParsedGrantRecord | null {
  const title = normalizeWhitespace(page.lines.find(line => /Subvenciones|Ayudas/i.test(line)) ?? entry.titleHint)
  const summaryLines = sectionBetween(page.lines, [/^Descripci[oó]n$/i], [/^(?:[¿?]A qui[eé]n va dirigido\?|Plazo|Requisitos|C[oó]mo realizar el tr[aá]mite|Documentaci[oó]n|M[aá]s Informaci[oó]n)$/i])
  const requirements = cleanupSectionLines(sectionBetween(page.lines, [/^Requisitos$/i], [/^(?:C[oó]mo realizar el tr[aá]mite|Documentaci[oó]n|M[aá]s Informaci[oó]n)$/i]))
  const beneficiaries = cleanupSectionLines(sectionBetween(page.lines, [/^[¿?]A qui[eé]n va dirigido\?$/i], [/^(?:Proyectos y actuaciones subvencionables:|Plazo|Requisitos)$/i]))
  const expenses = cleanupSectionLines(sectionBetween(page.lines, [/^Proyectos y actuaciones subvencionables:?$/i], [/^(?:Cuant[ií]a m[aá]xima|Plazo|Requisitos)$/i]), 10)
  const documents = cleanupSectionLines(sectionBetween(page.lines, [/^Documentaci[oó]n$/i], [/^(?:M[aá]s Informaci[oó]n|Tramitaci[oó]n|Fundamento legal)$/i]), 10)
  const periodLine = page.lines.find(line => /Del \d{2}\/\d{2}\/\d{4} hasta \d{2}\/\d{2}\/\d{4}/i.test(line))
  const dates = findDates(periodLine ?? page.text)
  const openingDate = dates[0] ?? null
  const deadline = dates[1] ?? null
  const bodyText = normalizeWhitespace(page.lines.join(' '))

  if (!title || !looksBusinessRelevant(title, `${bodyText} ${beneficiaries.join(' ')}`)) return null

  return {
    externalId: entry.externalId,
    title,
    summary: summaryFromLines(summaryLines, bodyText),
    body: bodyText,
    organismo: normalizeWhitespace(page.lines.find(line => /Área de Gobierno/i.test(line)) ?? 'Ayuntamiento de Madrid'),
    sourceUrl: page.url,
    publicationDate: openingDate,
    openingDate,
    deadline,
    status: inferStatus(page.text, openingDate, deadline),
    grantType: inferGrantType(bodyText),
    scope: 'municipal',
    regions: ['Madrid'],
    sectors: dedupeStrings([
      /comercial/i.test(bodyText) ? 'comercio' : null,
      /hosteler/i.test(bodyText) ? 'hostelería' : null,
      /hotelero/i.test(bodyText) ? 'hostelería' : null,
      /mercados municipales/i.test(bodyText) ? 'mercados' : null,
    ]),
    cnaeCodes: [],
    tags: tagsFromText(title, bodyText, beneficiaries.join(' ')),
    budgetTotal: extractBudgetTotal(bodyText),
    budgetPerCompanyMin: null,
    budgetPerCompanyMax: extractBudgetPerCompanyMax(bodyText),
    minEmployees: null,
    maxEmployees: null,
    minRevenue: null,
    maxRevenue: null,
    minCompanyAgeYears: null,
    requirements: cleanupSectionLines([...beneficiaries, ...requirements]),
    eligibleExpenses: expenses,
    requiredDocuments: documents,
    rawText: bodyText,
    detailJson: toJsonObject({
      source: 'madrid',
      beneficiaries,
      expenses,
      documents,
    }),
  }
}

function parseCommunityMadridGrant(page: HtmlPage, entry: DiscoveryEntry): ParsedGrantRecord | null {
  const title = normalizeWhitespace(
    page.lines.find(line => line === entry.titleHint || /^Ayudas?|^Subvenci[oó]n|^Cheque/i.test(line)) ?? entry.titleHint,
  )
  const bodyText = normalizeWhitespace(page.lines.join(' '))

  if (!title || !looksBusinessRelevant(title, bodyText)) return null

  const summaryLines = cleanupSectionLines([
    ...page.lines.filter(line => /^Ayudas?|^Subvenci[oó]n|^Procedimiento|^Estas ayudas|^La finalidad/i.test(line)),
  ], 6)
  const beneficiaries = cleanupSectionLines(sectionBetween(page.lines, [/^Personas destinatarias$/i, /^Beneficiarios$/i], [/^(?:Requisitos|Tramitaci[oó]n|Calendario de actuaciones|Solicitud|Documentaci[oó]n|Contacto y ayuda)$/i]), 10)
  const requirements = cleanupSectionLines(sectionBetween(page.lines, [/^Requisitos$/i], [/^(?:Tramitaci[oó]n|Calendario de actuaciones|Solicitud|Documentaci[oó]n|Contacto y ayuda)$/i]), 12)
  const expenses = cleanupSectionLines([
    ...page.lines.filter(line => /^Son subvencionables/i.test(line)),
    ...page.lines.filter(line => /^Se subvenciona/i.test(line)),
    ...page.lines.filter(line => /^\d+\.\s/.test(line)),
  ], 10)
  const documents = cleanupSectionLines(sectionBetween(page.lines, [/^Documentaci[oó]n$/i], [/^(?:Tramitaci[oó]n|Calendario de actuaciones|Contacto y ayuda)$/i]), 10)
  const publicationDate = findDates(page.lines.find(line => /[ÚU]ltima actualizaci[oó]n/i.test(line)) ?? '')[0] ?? null
  const deadlineLine = page.lines.find(line => /Fecha de fin:|En plazo:|Apertura de plazo:|Finalizado|Cerrado/i.test(line)) ?? ''
  const dates = findDates(`${bodyText} ${deadlineLine}`)
  const openingDate = dates[0] ?? publicationDate
  const deadline = deadlineLine ? findDates(deadlineLine)[0] ?? dates[1] ?? null : dates[1] ?? null

  return {
    externalId: entry.externalId,
    title,
    summary: summaryFromLines([...summaryLines, ...beneficiaries], bodyText),
    body: bodyText,
    organismo: normalizeWhitespace(page.lines.find(line => /Consejer[ií]a|Comunidad de Madrid/i.test(line)) ?? 'Comunidad de Madrid'),
    sourceUrl: page.url,
    publicationDate,
    openingDate,
    deadline,
    status: inferStatus(bodyText, openingDate, deadline),
    grantType: inferGrantType(bodyText),
    scope: 'autonomico',
    regions: ['Comunidad de Madrid'],
    sectors: dedupeStrings([
      /digital/i.test(bodyText) ? 'digitalización' : null,
      /innovaci[oó]n|i\+d/i.test(bodyText) ? 'innovación' : null,
      /industr/i.test(bodyText) ? 'industria' : null,
      /comerc/i.test(bodyText) ? 'comercio' : null,
      /artesan/i.test(bodyText) ? 'artesanía' : null,
    ]),
    cnaeCodes: [],
    tags: tagsFromText(title, bodyText, beneficiaries.join(' ')),
    budgetTotal: extractBudgetTotal(bodyText),
    budgetPerCompanyMin: null,
    budgetPerCompanyMax: extractBudgetPerCompanyMax(bodyText),
    minEmployees: null,
    maxEmployees: null,
    minRevenue: null,
    maxRevenue: null,
    minCompanyAgeYears: null,
    requirements: cleanupSectionLines([...beneficiaries, ...requirements], 12),
    eligibleExpenses: expenses,
    requiredDocuments: documents,
    rawText: bodyText,
    detailJson: toJsonObject({
      source: 'comunidad-madrid',
      beneficiaries,
      expenses,
      documents,
    }),
  }
}

function parseCataloniaGrant(page: HtmlPage, entry: DiscoveryEntry): ParsedGrantRecord | null {
  const title = normalizeWhitespace(page.lines.find(line => line === entry.titleHint || /Subvencions|Ajuts/i.test(line)) ?? entry.titleHint)
  const targetLine = page.lines.find(line => /Empreses i professionals/i.test(line)) ?? ''
  if (!/Empreses i professionals/i.test(targetLine)) return null

  const bodyText = normalizeWhitespace(page.lines.join(' '))
  if (!title || !looksBusinessRelevant(title, bodyText)) return null

  const mainIndex = lineIndex(page.lines, /^Qu[eè] has de saber\?$/i)
  const bodyLines = mainIndex >= 0 ? page.lines.slice(mainIndex) : page.lines
  const summary = summaryFromLines(sectionBetween(bodyLines, [/^Qu[eè] és\?$/i], [/^(?:A qui va dirigit\?|Terminis|Documentaci[oó]|Requisits|Taxes|Altres informacions)$/i]), bodyText)
  const requirements = cleanupSectionLines(sectionBetween(bodyLines, [/^Requisits$/i], [/^(?:Taxes|Altres informacions|Passos a fer)$/i]))
  const documents = cleanupSectionLines(sectionBetween(bodyLines, [/^Documentaci[oó]$/i], [/^(?:Requisits|Taxes|Altres informacions)$/i]), 10)
  const dates = findDates(bodyText)
  const openingDate = dates[0] ?? null
  const deadline = dates[1] ?? null
  const bdnsRef = bodyText.match(/BDNS\s+(\d{5,})/i)?.[1] ?? null

  return {
    externalId: bdnsRef ?? entry.externalId,
    title,
    summary,
    body: bodyText,
    organismo: normalizeWhitespace(page.lines.find(line => /Departament/i.test(line)) ?? 'Generalitat de Catalunya'),
    sourceUrl: page.url,
    publicationDate: openingDate ?? findDates(page.lines.find(line => /Data d'actualitzaci[oó]/i.test(line)) ?? '')[0] ?? null,
    openingDate,
    deadline,
    status: inferStatus(bodyText, openingDate, deadline),
    grantType: inferGrantType(bodyText),
    scope: 'autonomico',
    regions: ['Cataluña'],
    sectors: dedupeStrings([
      /digital/i.test(bodyText) ? 'digitalización' : null,
      /tecnolog/i.test(bodyText) ? 'tecnología' : null,
      /cultural/i.test(bodyText) ? 'cultura' : null,
    ]),
    cnaeCodes: [],
    tags: tagsFromText(title, bodyText, targetLine),
    budgetTotal: extractBudgetTotal(bodyText),
    budgetPerCompanyMin: null,
    budgetPerCompanyMax: extractBudgetPerCompanyMax(bodyText),
    minEmployees: null,
    maxEmployees: null,
    minRevenue: null,
    maxRevenue: null,
    minCompanyAgeYears: null,
    requirements: cleanupSectionLines([targetLine, ...requirements]),
    eligibleExpenses: cleanupSectionLines(sectionBetween(bodyLines, [/^Qu[eè] és\?$/i], [/^(?:A qui va dirigit\?|Terminis)$/i]), 8),
    requiredDocuments: documents,
    rawText: bodyText,
    detailJson: toJsonObject({
      source: 'cataluna',
      target: targetLine,
      bdns_ref: bdnsRef,
      documents,
    }),
  }
}

function parseAndaluciaGrant(page: HtmlPage, entry: DiscoveryEntry): ParsedGrantRecord | null {
  const title = normalizeWhitespace(page.lines.find(line => /^Ayudas|^Subvenciones|^InnovAndaluc[ií]a/i.test(line)) ?? entry.titleHint)
  const bodyText = normalizeWhitespace(page.lines.join(' '))
  if (!title || !looksBusinessRelevant(title, bodyText)) return null

  const objective = cleanupSectionLines(sectionBetween(page.lines, [/^Objetivo de las ayudas$/i, /^Podr[aá]n solicitar esta subvenci[oó]n$/i, /^Desarrollo del comercio exterior/i], [/^(?:L[ií]neas de las subvenciones|Presupuesto de la convocatoria|Resuelve tus dudas|Requisitos para la obtenci[oó]n de la subvenci[oó]n|Plazo de presentaci[oó]n de solicitudes|Lugar y forma de presentaci[oó]n de solicitudes)$/i]), 8)
  const requirements = cleanupSectionLines(sectionBetween(page.lines, [/^Requisitos para la obtenci[oó]n de la subvenci[oó]n$/i], [/^(?:Plazo de presentaci[oó]n de solicitudes|Lugar y forma de presentaci[oó]n de solicitudes|Publicaci[oó]n)/i]), 10)
  const deadlineLine = page.lines.find(line => /hasta el \d{1,2} de [a-záéíóú]+ de \d{4}|finalizar[aá] el d[ií]a|Plazo cerrado/i.test(line)) ?? ''
  const dates = findDates(`${page.text} ${deadlineLine}`)
  const openingDate = dates[0] ?? null
  const deadline = dates[1] ?? null
  const beneficiaries = cleanupSectionLines([
    ...page.lines.filter(line => /^Estas ayudas est[aá]n destinadas/i.test(line)),
    ...page.lines.filter(line => /^Podr[aá]n solicitar la subvenci[oó]n/i.test(line)),
  ], 4)

  return {
    externalId: entry.externalId,
    title,
    summary: summaryFromLines(objective, bodyText),
    body: bodyText,
    organismo: normalizeWhitespace(page.lines.find(line => /Consejer[ií]a|Junta de Andaluc[ií]a|TRADE/i.test(line)) ?? 'Junta de Andalucía'),
    sourceUrl: page.url,
    publicationDate: openingDate,
    openingDate,
    deadline,
    status: inferStatus(bodyText, openingDate, deadline),
    grantType: inferGrantType(bodyText),
    scope: 'autonomico',
    regions: ['Andalucía'],
    sectors: dedupeStrings([
      /innovaci[oó]n/i.test(bodyText) ? 'innovación' : null,
      /internacionaliz/i.test(bodyText) ? 'internacionalización' : null,
      /empleo/i.test(bodyText) ? 'empleo' : null,
      /industr/i.test(bodyText) ? 'industria' : null,
    ]),
    cnaeCodes: [],
    tags: tagsFromText(title, bodyText, beneficiaries.join(' ')),
    budgetTotal: extractBudgetTotal(bodyText),
    budgetPerCompanyMin: null,
    budgetPerCompanyMax: extractBudgetPerCompanyMax(bodyText),
    minEmployees: null,
    maxEmployees: null,
    minRevenue: null,
    maxRevenue: null,
    minCompanyAgeYears: null,
    requirements: cleanupSectionLines([...beneficiaries, ...requirements]),
    eligibleExpenses: objective,
    requiredDocuments: cleanupSectionLines(page.lines.filter(line => /Anexo|Solicitud|ACCEDER AL TR[ÁA]MITE/i.test(line)), 8),
    rawText: bodyText,
    detailJson: toJsonObject({
      source: 'andalucia',
      objective,
      beneficiaries,
    }),
  }
}

function parseGrantDetail(page: HtmlPage, entry: DiscoveryEntry) {
  switch (entry.sourceCode) {
    case 'boe':
      return parseBoeGrant(page, entry)
    case 'ccaa-comunidad-de-madrid':
      return parseCommunityMadridGrant(page, entry)
    case 'local-madrid':
      return parseMadridGrant(page, entry)
    case 'ccaa-cataluna':
      return parseCataloniaGrant(page, entry)
    case 'ccaa-andalucia':
      return parseAndaluciaGrant(page, entry)
    default:
      return null
  }
}

async function discoverEntriesForPublisher(code: SupportedPublisherCode, limit: number) {
  switch (code) {
    case 'boe':
      return discoverBoeEntries(limit)
    case 'ccaa-comunidad-de-madrid':
      return discoverCommunityMadridEntries(limit)
    case 'local-madrid':
      return discoverMadridEntries(limit)
    case 'ccaa-cataluna':
      return discoverCataloniaEntries(limit)
    case 'ccaa-andalucia':
      return discoverAndaluciaEntries(limit)
  }
}

export function supportedGrantPublisherCodes() {
  return IMPLEMENTED_PUBLISHER_CODES
}

export function grantPublisherIsImplemented(code: string) {
  return IMPLEMENTED_PUBLISHER_CODES.includes(code as (typeof IMPLEMENTED_PUBLISHER_CODES)[number])
}

export async function syncOfficialGrantPublisher(publisher: GrantPublisher, options: { maxItems?: number } = {}): Promise<SyncPublisherStats> {
  const code = publisher.code as SupportedPublisherCode
  const maxItems = Math.max(4, options.maxItems ?? 12)
  const stats: SyncPublisherStats = {
    discoveredCount: 0,
    fetchedCount: 0,
    enrichedCount: 0,
    publishedCount: 0,
    rejectedCount: 0,
    errors: [],
  }

  if (!grantPublisherIsImplemented(code)) {
    throw new Error(`publisher_not_supported:${publisher.code}`)
  }

  const entries = await discoverEntriesForPublisher(code, maxItems)
  stats.discoveredCount = entries.length

  for (const entry of entries) {
    try {
      const page = await fetchHtmlPage(entry.detailUrl)
      stats.fetchedCount += 1
      const parsed = parseGrantDetail(page, entry)
      if (!parsed) continue

      const grantId = await upsertLegacyGrant(publisher.code, parsed)
      const sourceSnapshot = await fetchSourceDocumentSnapshot(parsed.sourceUrl)
      const artifacts = await persistGrantArtifacts(
        buildCanonicalInput(grantId, code, parsed),
        sourceSnapshot,
      )

      stats.enrichedCount += 1
      if (artifacts.quality.publicationStatus === 'published') stats.publishedCount += 1
      if (artifacts.quality.publicationStatus === 'rejected') stats.rejectedCount += 1
    } catch (error) {
      stats.errors.push(`${publisher.code}:${entry.externalId}:${error instanceof Error ? error.message : 'unknown_error'}`)
    }
  }

  return stats
}
