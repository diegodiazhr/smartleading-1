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

export interface GuideStep {
  id: string
  order: number
  title: string
  description: string
  type: 'document' | 'action' | 'submission' | 'verification'
  tip?: string
  estimated_days?: number
  required: boolean
}

export interface GuideDocument {
  id: string
  name: string
  description: string
  where_to_get: string
  format?: string
  required: boolean
}

export interface ApplicationGuide {
  generated_at: string
  submission_channel: string
  estimated_total_days: number
  steps: GuideStep[]
  documents: GuideDocument[]
  warnings: string[]
  key_requirements: string[]
}

interface GrantContext {
  title: string
  organismo: string | null
  summary: string | null
  body: string | null
  deadline: string | null
  opening_date: string | null
  grant_type: string
  scope: string
  regions: string[]
  sectors: string[]
  cnae_codes: string[]
  budget_per_company_min: number | null
  budget_per_company_max: number | null
  min_employees: number | null
  max_employees: number | null
  source_url: string | null
  tags: string[]
  keywords: string[]
}

interface CompanyContext {
  name: string
  cif: string
  region: string | null
  employees_count: number
  revenue_annual: number
  is_startup: boolean
  has_rd: boolean
  cnae_primary: string | null
  founding_date: string | null
}

export async function generateApplicationGuide(
  grant: GrantContext,
  company: CompanyContext
): Promise<ApplicationGuide> {
  const client = getClient()

  const deadline = grant.deadline
    ? new Date(grant.deadline).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
    : 'No especificado'

  const prompt = `Eres un experto en subvenciones públicas españolas. Debes generar una guía de presentación personalizada y práctica para que esta empresa pueda solicitar esta subvención.

SUBVENCIÓN:
- Título: ${grant.title}
- Organismo: ${grant.organismo ?? 'No especificado'}
- Tipo: ${grant.grant_type}
- Ámbito: ${grant.scope}
- Plazo de solicitud: ${deadline}
- Importe máximo por empresa: ${grant.budget_per_company_max ? `${grant.budget_per_company_max.toLocaleString('es-ES')} €` : 'No especificado'}
- Temáticas: ${grant.tags.join(', ') || 'General'}
- Sectores: ${grant.sectors.join(', ') || 'Todos'}
- Descripción: ${grant.summary ?? grant.body?.slice(0, 500) ?? 'No disponible'}
- URL convocatoria: ${grant.source_url ?? 'No disponible'}

EMPRESA SOLICITANTE:
- Nombre: ${company.name}
- CIF: ${company.cif}
- Comunidad Autónoma: ${company.region ?? 'No especificada'}
- Empleados: ${company.employees_count}
- Facturación anual: ${company.revenue_annual.toLocaleString('es-ES')} €
- Startup: ${company.is_startup ? 'Sí' : 'No'}
- Actividades I+D: ${company.has_rd ? 'Sí' : 'No'}
- CNAE: ${company.cnae_primary ?? 'No especificado'}
- Año constitución: ${company.founding_date ? new Date(company.founding_date).getFullYear() : 'No especificado'}

Genera una guía de presentación REALISTA y ESPECÍFICA para esta subvención y empresa. Devuelve SOLO JSON válido con esta estructura exacta:

{
  "submission_channel": "descripción del canal (sede electrónica, presencial, etc.)",
  "estimated_total_days": número_de_días_estimados_para_preparar,
  "steps": [
    {
      "id": "step-1",
      "order": 1,
      "title": "Título breve del paso",
      "description": "Descripción detallada y práctica de qué hacer exactamente",
      "type": "document|action|submission|verification",
      "tip": "Consejo práctico opcional",
      "estimated_days": días_estimados,
      "required": true
    }
  ],
  "documents": [
    {
      "id": "doc-1",
      "name": "Nombre del documento",
      "description": "Para qué sirve y qué debe contener",
      "where_to_get": "Dónde y cómo obtenerlo",
      "format": "PDF / Original / etc.",
      "required": true
    }
  ],
  "warnings": ["Aviso importante 1", "Aviso importante 2"],
  "key_requirements": ["Requisito clave 1", "Requisito clave 2"]
}

IMPORTANTE:
- Los pasos deben ser en orden cronológico lógico (primero reunir docs, luego rellenar formularios, luego enviar, luego verificar)
- Los documentos deben ser los típicos de este tipo de subvención (certificados AEAT, SS, escrituras, memoria técnica, etc.)
- Mínimo 5 pasos, máximo 10
- Mínimo 5 documentos, máximo 12
- Mínimo 2 avisos importantes
- Todo en español, tono profesional pero claro`

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
    max_tokens: 2500,
    response_format: { type: 'json_object' },
  })

  const content = response.choices[0]?.message?.content
  if (!content) throw new Error('Empty response from OpenAI')

  const parsed = JSON.parse(content) as Omit<ApplicationGuide, 'generated_at'>
  return {
    ...parsed,
    generated_at: new Date().toISOString(),
  }
}
