import OpenAI from 'openai'
import type { DocumentType } from './application-guide'

let _client: OpenAI | null = null
function getClient(): OpenAI {
  if (!_client) {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) throw new Error('Missing OPENAI_API_KEY env var')
    _client = new OpenAI({ apiKey })
  }
  return _client
}

// ── Question types (AI-generated per grant/doc) ───────────────────���───────

export interface QuestionnaireQuestion {
  id: string
  label: string
  type: 'text' | 'textarea' | 'number' | 'date' | 'select'
  required: boolean
  placeholder?: string
  hint?: string
  options?: { value: string; label: string }[]
}

export interface QuestionnaireContext {
  documentName: string
  documentType: DocumentType
  templateHint?: string
  grant: {
    title: string
    organismo: string | null
    summary: string | null
    body: string | null
    grant_type: string
    scope: string
    budget_per_company_max: number | null
    tags: string[]
    requirements?: unknown
  }
  company: {
    name: string
    cif: string
    region: string | null
    municipality: string | null
    employees_count: number
    revenue_annual: number
    founding_date: string | null
    is_startup: boolean
    has_rd: boolean
    cnae_primary: string | null
    cnae_secondary?: string[]
    website: string | null
  }
}

export async function generateQuestionnaire(ctx: QuestionnaireContext): Promise<QuestionnaireQuestion[]> {
  const client = getClient()

  const foundingYear = ctx.company.founding_date
    ? new Date(ctx.company.founding_date).getFullYear()
    : null

  const systemPrompt = `Eres un experto en solicitudes de subvenciones públicas españolas.
Tu tarea es generar un cuestionario personalizado para que una empresa pueda completar un documento de subvención.

REGLAS:
1. Genera entre 5 y 12 preguntas específicas para ESTE documento y ESTA convocatoria
2. No preguntes por datos que ya tienes del perfil de empresa
3. Las preguntas deben obtener información real y específica, no genérica
4. Ordena las preguntas de más a menos importante
5. Para declaraciones responsables: pide datos del representante legal
6. Para memorias técnicas: enfócate en el proyecto específico, metodología, resultados medibles
7. Para presupuestos: pide partidas concretas con importes
8. Para planes de viabilidad: pide proyecciones reales, mercado objetivo, competencia
9. Devuelve SOLO un array JSON válido con la estructura indicada`

  const userPrompt = `Genera el cuestionario para el siguiente documento:

DOCUMENTO: ${ctx.documentName}
TIPO: ${ctx.documentType}
${ctx.templateHint ? `ESTRUCTURA REQUERIDA: ${ctx.templateHint}` : ''}

CONVOCATORIA:
- Título: ${ctx.grant.title}
- Organismo: ${ctx.grant.organismo ?? 'No especificado'}
- Tipo de ayuda: ${ctx.grant.grant_type} · ${ctx.grant.scope}
- Importe máximo: ${ctx.grant.budget_per_company_max ? `${ctx.grant.budget_per_company_max.toLocaleString('es-ES')} €` : 'No especificado'}
- Descripción: ${ctx.grant.summary ?? ''}
- Texto oficial: ${ctx.grant.body?.slice(0, 1200) ?? '(no disponible)'}

DATOS YA DISPONIBLES DE LA EMPRESA (NO preguntar por estos):
- Nombre: ${ctx.company.name}
- CIF: ${ctx.company.cif}
- Región: ${ctx.company.region ?? 'No especificada'}
- Municipio: ${ctx.company.municipality ?? 'No especificado'}
- Empleados: ${ctx.company.employees_count}
- Facturación anual: ${ctx.company.revenue_annual.toLocaleString('es-ES')} €
- Año de constitución: ${foundingYear ?? 'No especificado'}
- Startup: ${ctx.company.is_startup ? 'Sí' : 'No'}
- I+D: ${ctx.company.has_rd ? 'Sí' : 'No'}
- CNAE principal: ${ctx.company.cnae_primary ?? 'No especificado'}
- Web: ${ctx.company.website ?? 'No especificada'}

Devuelve EXACTAMENTE este formato JSON (array, sin texto adicional):
[
  {
    "id": "clave_unica_sin_espacios",
    "label": "Pregunta en español",
    "type": "textarea",
    "required": true,
    "placeholder": "Ejemplo de respuesta...",
    "hint": "Explicación o consejo opcional"
  }
]

Tipos disponibles: text, textarea, number, date, select (incluir "options" si es select).`

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3,
    max_tokens: 2000,
  })

  const raw = response.choices[0]?.message?.content ?? '{}'
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('Invalid JSON from questionnaire AI')
  }

  // Handle both { questions: [...] } and direct array
  const questions = Array.isArray(parsed)
    ? parsed
    : (parsed as Record<string, unknown>).questions ?? (parsed as Record<string, unknown>).cuestionario ?? []

  if (!Array.isArray(questions) || questions.length === 0) {
    throw new Error('No questions returned from AI')
  }

  return questions as QuestionnaireQuestion[]
}

// ── Document generation ────────────────────────────────────────────────────

export interface GenerationContext {
  documentName: string
  documentType: DocumentType
  templateHint: string
  grant: {
    title: string
    organismo: string | null
    summary: string | null
    body: string | null
    deadline: string | null
    grant_type: string
    scope: string
    source_url: string | null
    budget_per_company_max: number | null
    tags: string[]
  }
  company: {
    name: string
    cif: string
    region: string | null
    municipality: string | null
    employees_count: number
    revenue_annual: number
    founding_date: string | null
    is_startup: boolean
    has_rd: boolean
    cnae_primary: string | null
    website: string | null
  }
  requestedAmount: number | null
  intake: Record<string, string | number>
  questions?: QuestionnaireQuestion[]
}

const DOC_SYSTEM_PROMPT = `Eres un experto redactor de documentación para solicitudes de subvenciones públicas españolas con 15 años de experiencia.
Redactas documentos formales, completos y de alta calidad que maximizan las posibilidades de aprobación.

REGLAS ABSOLUTAS — NUNCA LAS INCUMPLAS:
1. NUNCA inventes información, datos, nombres, fechas, importes ni estadísticas
2. Si una sección necesita información que NO se te ha proporcionado, escribe exactamente: [INFORMACIÓN PENDIENTE: describe aquí qué dato falta y por qué es necesario]
3. Usa SOLO los datos reales proporcionados en este prompt
4. Tono formal y técnico propio de la administración pública española
5. El documento debe tener MÍNIMO 700 palabras para memorias técnicas y planes de viabilidad
6. Para declaraciones responsables: mínimo 3 secciones formales completas
7. Para presupuestos: incluir tabla detallada con todas las partidas proporcionadas
8. Usa Markdown: ## para secciones principales, ### para subsecciones, **negrita** para datos clave
9. Incluye siempre: cabecera formal (empresa + convocatoria + fecha), desarrollo completo del documento, pie con lugar/fecha/firma
10. Donde el usuario haya dado datos específicos, úsalos literalmente — no parafrasees`

export async function generateDocument(ctx: GenerationContext): Promise<string> {
  const client = getClient()

  const deadline = ctx.grant.deadline
    ? new Date(ctx.grant.deadline).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
    : 'No especificado'

  const foundingYear = ctx.company.founding_date
    ? new Date(ctx.company.founding_date).getFullYear()
    : 'No especificado'

  // Build intake text using question labels for better context
  const intakeText = Object.entries(ctx.intake)
    .filter(([, v]) => v !== '' && v !== null && v !== undefined)
    .map(([k, v]) => {
      const question = ctx.questions?.find(q => q.id === k)
      const label = question?.label ?? k
      return `**${label}**\n${v}`
    })
    .join('\n\n')

  const userPrompt = `Genera el siguiente documento completo para una solicitud de subvención:

## DOCUMENTO A GENERAR
- Nombre: ${ctx.documentName}
- Tipo: ${ctx.documentType}
- Secciones requeridas: ${ctx.templateHint || 'Estructura estándar para este tipo de documento en subvenciones públicas españolas'}

---

## DATOS DE LA CONVOCATORIA
- **Título**: ${ctx.grant.title}
- **Organismo convocante**: ${ctx.grant.organismo ?? '[INFORMACIÓN PENDIENTE: nombre del organismo convocante]'}
- **Tipo de ayuda**: ${ctx.grant.grant_type} · ámbito ${ctx.grant.scope}
- **Plazo de solicitud**: ${deadline}
- **Importe solicitado**: ${ctx.requestedAmount ? `${ctx.requestedAmount.toLocaleString('es-ES')} €` : '[INFORMACIÓN PENDIENTE: importe a solicitar]'}
- **Importe máximo disponible**: ${ctx.grant.budget_per_company_max ? `${ctx.grant.budget_per_company_max.toLocaleString('es-ES')} €` : 'No especificado'}
- **Resumen**: ${ctx.grant.summary ?? '(no disponible)'}
- **Texto oficial de la convocatoria**:
${ctx.grant.body?.slice(0, 1500) ?? '(no disponible)'}

---

## DATOS DE LA EMPRESA
- **Razón social**: ${ctx.company.name}
- **CIF**: ${ctx.company.cif}
- **Comunidad Autónoma**: ${ctx.company.region ?? '[INFORMACIÓN PENDIENTE: comunidad autónoma]'}
- **Municipio**: ${ctx.company.municipality ?? 'No especificado'}
- **Número de empleados**: ${ctx.company.employees_count}
- **Facturación anual**: ${ctx.company.revenue_annual.toLocaleString('es-ES')} €
- **Año de constitución**: ${foundingYear}
- **Es startup**: ${ctx.company.is_startup ? 'Sí' : 'No'}
- **Realiza I+D**: ${ctx.company.has_rd ? 'Sí' : 'No'}
- **CNAE principal**: ${ctx.company.cnae_primary ?? 'No especificado'}
- **Página web**: ${ctx.company.website ?? 'No especificada'}

---

## INFORMACIÓN APORTADA POR LA EMPRESA
${intakeText || '[INFORMACIÓN PENDIENTE: el usuario no ha completado el cuestionario]'}

---

## INSTRUCCIONES FINALES
Genera el documento COMPLETO en Markdown.
- Usa los datos reales de la empresa en cada sección
- Donde falte información, usa el marcador [INFORMACIÓN PENDIENTE: describe qué falta]
- El documento debe ser formal, técnico, convincente y directamente presentable
- No incluyas comentarios ni notas meta-textuales fuera del documento`

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: DOC_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.2,
    max_tokens: 6000,
  })

  const content = response.choices[0]?.message?.content
  if (!content) throw new Error('Empty response from AI')
  return content
}
