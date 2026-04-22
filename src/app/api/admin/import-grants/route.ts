import { createAdminClient } from '@/lib/supabase/admin'
import * as XLSX from 'xlsx'
import { getAdminCaller } from '@/lib/admin-auth'
import { logAdminEvent } from '@/lib/admin-audit'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// Column indices (0-based) in the Excel sheet
const COL = {
  BDNS_CODE: 0,
  MRR: 1,
  ADMINISTRACION: 2,
  DEPARTAMENTO: 3,
  ORGANO: 4,
  FECHA_REGISTRO: 5,
  TITULO: 6,
} as const

function inferScope(admin: string): 'nacional' | 'autonomico' | 'europeo' | 'municipal' {
  const a = admin.toLowerCase()
  if (
    a.includes('comunidad autónoma') || a.includes('junta de') || a.includes('generalitat') ||
    a.includes('govern ') || a.includes('xunta') || a.includes('diputación foral') ||
    a.includes('gobierno de canarias') || a.includes('gobierno de la rioja') ||
    a.includes('gobierno de aragón') || a.includes('gobierno de cantabria') ||
    a.includes('gobierno de navarra') || a.includes('gobierno de extremadura') ||
    a.includes('gobierno de asturias') || a.includes('gobierno de murcia') ||
    a.includes('gobierno de baleares') || a.includes('govern de les illes')
  ) return 'autonomico'
  if (
    a.includes('ayuntamiento') || a.includes('diputación provincial') ||
    a.includes('mancomunidad') || a.includes('cabildo') || a.includes('consell insular') ||
    a.includes('entidad local')
  ) return 'municipal'
  if (a.includes('unión europea') || a.includes('comisión europea') || a.includes('fondo europeo')) {
    return 'europeo'
  }
  return 'nacional'
}

function parseDate(raw: unknown): string | null {
  if (!raw) return null
  // xlsx may return a Date object when cellDates:true
  if (raw instanceof Date) {
    return raw.toISOString().split('T')[0]
  }
  const s = String(raw).trim()
  if (!s) return null
  // DD/MM/YYYY
  const match = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (match) {
    const [, d, m, y] = match
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  // YYYY-MM-DD passthrough
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  return null
}

function buildOrganismo(admin: string, dept: string, organo: string): string {
  // Most specific → least specific: use Órgano if available, else Departamento, else Administración
  return organo?.trim() || dept?.trim() || admin?.trim() || ''
}

interface GrantRow {
  external_id: string
  title: string
  organismo: string
  publication_date: string | null
  source: 'bdns'
  status: 'abierta'
  grant_type: 'fondo_perdido'
  scope: 'nacional' | 'autonomico' | 'europeo' | 'municipal'
  tags: string[]
  regions: string[]
  sectors: string[]
  cnae_codes: string[]
  budget_total: null
  budget_per_company_min: null
  budget_per_company_max: null
}

export async function POST(request: Request) {
  const caller = await getAdminCaller()
  if (!caller) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return Response.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  if (!file) return Response.json({ error: 'No file provided' }, { status: 400 })

  const ext = file.name.split('.').pop()?.toLowerCase()
  if (!['xlsx', 'xls', 'csv'].includes(ext ?? '')) {
    return Response.json({ error: 'Formato no soportado. Usa .xlsx, .xls o .csv' }, { status: 400 })
  }

  // Parse workbook
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' })

  if (rows.length < 2) {
    return Response.json({ error: 'El archivo está vacío o solo tiene cabeceras' }, { status: 400 })
  }

  // Skip header row
  const dataRows = rows.slice(1) as unknown[][]

  // Parse rows into grant objects
  const parsed: GrantRow[] = []
  const parseErrors: string[] = []

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i]
    const bdnsCode = String(row[COL.BDNS_CODE] ?? '').trim()
    const titulo = String(row[COL.TITULO] ?? '').trim()

    if (!bdnsCode || !titulo) {
      parseErrors.push(`Fila ${i + 2}: Código BDNS o título vacío — omitida`)
      continue
    }

    const mrr = String(row[COL.MRR] ?? '').trim().toUpperCase()
    const administracion = String(row[COL.ADMINISTRACION] ?? '').trim()
    const departamento = String(row[COL.DEPARTAMENTO] ?? '').trim()
    const organo = String(row[COL.ORGANO] ?? '').trim()
    const fechaRaw = row[COL.FECHA_REGISTRO]

    const tags: string[] = []
    if (mrr === 'SI' || mrr === 'SÍ' || mrr === 'S' || mrr === '1' || mrr === 'TRUE') {
      tags.push('mrr')
    }

    parsed.push({
      external_id: bdnsCode,
      title: titulo,
      organismo: buildOrganismo(administracion, departamento, organo),
      publication_date: parseDate(fechaRaw),
      source: 'bdns',
      status: 'abierta',
      grant_type: 'fondo_perdido',
      scope: inferScope(administracion),
      tags,
      regions: [],
      sectors: [],
      cnae_codes: [],
      budget_total: null,
      budget_per_company_min: null,
      budget_per_company_max: null,
    })
  }

  if (parsed.length === 0) {
    await logAdminEvent({
      actorUserId: caller.id,
      action: 'import_grants',
      entityType: 'operation',
      entityId: 'grant_import',
      targetLabel: 'Importar convocatorias',
      status: 'error',
      metadata: { reason: 'no_valid_rows', parseErrors: parseErrors.length },
    })
    return Response.json({
      error: 'No se encontraron filas válidas',
      parseErrors: parseErrors.slice(0, 20),
    }, { status: 400 })
  }

  // Deduplicate: fetch existing external_ids in batches of 1000
  const allExternalIds = parsed.map(r => r.external_id)
  const existingIds = new Set<string>()

  for (let i = 0; i < allExternalIds.length; i += 1000) {
    const chunk = allExternalIds.slice(i, i + 1000)
    const { data } = await admin
      .from('grants')
      .select('external_id')
      .in('external_id', chunk)
    for (const row of data ?? []) {
      if (row.external_id) existingIds.add(row.external_id)
    }
  }

  const toInsert = parsed.filter(r => !existingIds.has(r.external_id))
  const skipped = parsed.length - toInsert.length

  // Insert in batches of 500
  let inserted = 0
  let insertErrors = 0
  const errorDetails: string[] = []

  for (let i = 0; i < toInsert.length; i += 500) {
    const batch = toInsert.slice(i, i + 500)
    const { error } = await admin.from('grants').insert(batch)
    if (error) {
      insertErrors += batch.length
      errorDetails.push(error.message)
    } else {
      inserted += batch.length
    }
  }

  const stats = {
    total: dataRows.length,
    parsed: parsed.length,
    inserted,
    skipped,
    insertErrors,
    parseErrors: parseErrors.length,
  }

  await logAdminEvent({
    actorUserId: caller.id,
    action: 'import_grants',
    entityType: 'operation',
    entityId: 'grant_import',
    targetLabel: 'Importar convocatorias',
    status: insertErrors > 0 ? 'error' : 'success',
    metadata: stats,
  })

  return Response.json({
    ok: true,
    stats,
    parseErrors: parseErrors.slice(0, 10),
    errorDetails: errorDetails.slice(0, 5),
  })
}
