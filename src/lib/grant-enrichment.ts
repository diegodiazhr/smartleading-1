import OpenAI from 'openai'

let _client: OpenAI | null = null
function getClient(): OpenAI {
  if (!_client) {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) throw new Error('Missing OPENAI_API_KEY env var')
    _client = new OpenAI({ apiKey })
  }
  return _client
}

const SYSTEM_PROMPT = `Eres un experto en comunicación de subvenciones públicas para empresas españolas.
Tu tarea: transformar títulos y descripciones técnico-legales en textos atractivos para empresarios.

REGLAS:
- Título: máximo 8 palabras, claro, directo, orientado al beneficio. Sin siglas. Sin "Real Decreto", "BOE", "convocatoria" ni "ayudas".
- Descripción: 2-3 frases concisas. Explica QUÉ financia, QUIÉN puede pedir y CUÁNTO se puede obtener. Sin jerga legal.
- Idioma: español neutro y profesional.
- Responde SOLO con JSON válido, sin texto adicional.`

export interface EnrichedGrant {
  id: string
  title: string
  summary: string
}

export async function enrichGrant(raw: {
  id: string
  title: string
  summary: string | null
  organismo: string | null
  budget_per_company_max: number | null
  grant_type: string
  scope: string
  tags: string[]
}): Promise<EnrichedGrant> {
  const client = getClient()

  const userMessage = `Convierte este título y descripción de subvención:

TÍTULO ORIGINAL: ${raw.title}
ORGANISMO: ${raw.organismo ?? 'Desconocido'}
DESCRIPCIÓN ACTUAL: ${raw.summary ?? '(sin descripción)'}
IMPORTE MÁXIMO: ${raw.budget_per_company_max ? `${raw.budget_per_company_max.toLocaleString('es-ES')} €` : 'No especificado'}
TIPO: ${raw.grant_type}
ÁMBITO: ${raw.scope}
TEMÁTICAS: ${raw.tags.join(', ') || 'General'}

Devuelve exactamente este JSON:
{"title": "...", "summary": "..."}`

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userMessage },
    ],
    temperature: 0.4,
    max_tokens: 300,
    response_format: { type: 'json_object' },
  })

  const content = response.choices[0]?.message?.content
  if (!content) throw new Error('Empty response from OpenAI')

  const parsed = JSON.parse(content) as { title?: string; summary?: string }
  if (!parsed.title || !parsed.summary) throw new Error('Invalid JSON shape from OpenAI')

  return { id: raw.id, title: parsed.title, summary: parsed.summary }
}

export interface EnrichmentStats {
  total: number
  enriched: number
  failed: number
  durationMs: number
}

export async function enrichGrantsBatch(
  grants: Parameters<typeof enrichGrant>[0][],
  onProgress?: (done: number, total: number) => void
): Promise<EnrichmentStats> {
  const start = Date.now()
  let enriched = 0
  let failed = 0

  // Process in chunks of 10 (parallel) to avoid rate limits
  const CHUNK = 10
  for (let i = 0; i < grants.length; i += CHUNK) {
    const chunk = grants.slice(i, i + CHUNK)
    await Promise.all(chunk.map(async (grant) => {
      try {
        const result = await enrichGrant(grant)
        // Caller is responsible for persisting; this function just tracks counts
        void result
        enriched++
      } catch {
        failed++
      }
    }))
    onProgress?.(Math.min(i + CHUNK, grants.length), grants.length)
  }

  return { total: grants.length, enriched, failed, durationMs: Date.now() - start }
}
