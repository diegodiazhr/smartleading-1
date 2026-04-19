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

// ── Intake field definitions per document type ─────────────────────────────

export interface IntakeField {
  key: string
  label: string
  type: 'text' | 'textarea' | 'number' | 'date' | 'select'
  placeholder?: string
  options?: { value: string; label: string }[]
  required: boolean
  hint?: string
  prefill?: string  // key from company/grant context to auto-fill
}

export const INTAKE_FIELDS: Record<DocumentType, IntakeField[]> = {
  memoria_tecnica: [
    {
      key: 'proyecto_descripcion',
      label: '¿Qué vas a hacer con esta subvención?',
      type: 'textarea',
      placeholder: 'Describe brevemente las acciones o inversiones concretas que vas a llevar a cabo. Ej: "Adquirir 3 servidores para digitalizar el proceso de facturación y contratar a un consultor para su implantación."',
      required: true,
      hint: 'Sé específico. Cuanto más detalle, mejor será el documento generado.',
    },
    {
      key: 'proyecto_objetivo',
      label: 'Objetivo principal del proyecto',
      type: 'text',
      placeholder: 'Ej: Reducir el tiempo de procesamiento de pedidos en un 40%',
      required: true,
    },
    {
      key: 'proyecto_plazo_meses',
      label: 'Duración estimada del proyecto (meses)',
      type: 'number',
      placeholder: '12',
      required: true,
    },
    {
      key: 'proyecto_impacto',
      label: '¿Qué impacto esperas conseguir?',
      type: 'textarea',
      placeholder: 'Ej: Creación de 2 puestos de trabajo, ahorro del 30% en costes operativos, mejora de la productividad...',
      required: false,
      hint: 'Incluye indicadores cuantificables si los tienes.',
    },
    {
      key: 'proyecto_experiencia',
      label: '¿Tienes experiencia previa en proyectos similares?',
      type: 'textarea',
      placeholder: 'Ej: En 2023 implantamos un ERP con éxito que redujo errores de inventario un 25%.',
      required: false,
    },
  ],
  declaracion_responsable: [
    {
      key: 'representante_nombre',
      label: 'Nombre completo del representante legal',
      type: 'text',
      placeholder: 'Juan García Martínez',
      required: true,
    },
    {
      key: 'representante_dni',
      label: 'DNI / NIE del representante',
      type: 'text',
      placeholder: '12345678A',
      required: true,
    },
    {
      key: 'representante_cargo',
      label: 'Cargo del representante',
      type: 'select',
      options: [
        { value: 'Administrador Único', label: 'Administrador Único' },
        { value: 'Administrador Solidario', label: 'Administrador Solidario' },
        { value: 'Administrador Mancomunado', label: 'Administrador Mancomunado' },
        { value: 'Consejero Delegado', label: 'Consejero Delegado' },
        { value: 'Apoderado', label: 'Apoderado' },
        { value: 'Gerente', label: 'Gerente' },
        { value: 'Presidente', label: 'Presidente' },
      ],
      required: true,
    },
  ],
  plan_viabilidad: [
    {
      key: 'proyecto_descripcion',
      label: 'Descripción del proyecto o inversión',
      type: 'textarea',
      placeholder: 'Describe el proyecto, producto o servicio que vas a desarrollar...',
      required: true,
    },
    {
      key: 'mercado_objetivo',
      label: '¿A qué mercado o clientes va dirigido?',
      type: 'textarea',
      placeholder: 'Ej: PYMEs del sector industrial en España, con facturación entre 1M y 10M€',
      required: true,
    },
    {
      key: 'proyecto_plazo_meses',
      label: 'Duración del proyecto (meses)',
      type: 'number',
      placeholder: '24',
      required: true,
    },
    {
      key: 'proyeccion_ingresos',
      label: 'Proyección de ingresos estimada (€/año)',
      type: 'number',
      placeholder: '150000',
      required: false,
    },
    {
      key: 'proyecto_impacto',
      label: 'Impacto esperado (empleos, ventas, eficiencia...)',
      type: 'textarea',
      placeholder: 'Ej: Creación de 5 empleos directos, incremento del 20% en ventas...',
      required: false,
    },
  ],
  descripcion_proyecto: [
    {
      key: 'proyecto_descripcion',
      label: 'Describe el proyecto en detalle',
      type: 'textarea',
      placeholder: 'Explica qué vas a hacer, por qué y cómo...',
      required: true,
    },
    {
      key: 'proyecto_objetivo',
      label: 'Objetivo principal',
      type: 'text',
      placeholder: 'Ej: Digitalizar el proceso de producción',
      required: true,
    },
    {
      key: 'proyecto_plazo_meses',
      label: 'Duración estimada (meses)',
      type: 'number',
      placeholder: '12',
      required: true,
    },
  ],
  cronograma: [
    {
      key: 'proyecto_descripcion',
      label: 'Fases o hitos principales del proyecto',
      type: 'textarea',
      placeholder: 'Ej: Fase 1 (meses 1-3): análisis y diseño. Fase 2 (meses 4-8): desarrollo. Fase 3 (meses 9-12): implantación y formación.',
      required: true,
    },
    {
      key: 'proyecto_plazo_meses',
      label: 'Duración total (meses)',
      type: 'number',
      placeholder: '12',
      required: true,
    },
  ],
  presupuesto_detallado: [
    {
      key: 'proyecto_descripcion',
      label: 'Conceptos de gasto a financiar',
      type: 'textarea',
      placeholder: 'Ej: - Equipamiento informático: 15.000€\n- Consultoría técnica: 8.000€\n- Licencias software: 2.000€\n- Formación: 1.000€',
      required: true,
      hint: 'Lista cada partida con su importe aproximado.',
    },
  ],
  other_generated: [
    {
      key: 'proyecto_descripcion',
      label: 'Información adicional para el documento',
      type: 'textarea',
      placeholder: 'Añade cualquier información relevante para generar este documento...',
      required: true,
    },
  ],
  external: [],
}

// ── Generation ─────────────────────────────────────────────────────────────

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
}

const DOC_SYSTEM_PROMPT = `Eres un experto redactor de documentación para solicitudes de subvenciones públicas españolas.
Redactas documentos formales, completos y correctos que cumplen exactamente con lo que pide la convocatoria.

REGLAS ABSOLUTAS:
1. Genera SOLO el documento solicitado — ni más ni menos secciones que las indicadas
2. Usa el tono formal y técnico propio de la administración pública española
3. Rellena TODOS los datos con la información real de la empresa que se te proporciona
4. Si la convocatoria especifica secciones exactas, respétalas al 100%
5. El documento debe estar COMPLETO y listo para presentar (con la información proporcionada)
6. Usa Markdown para el formato: ## para secciones, **negrita** para datos clave, listas con -
7. Incluye siempre: cabecera con nombre empresa + convocatoria, cuerpo del documento, pie con lugar/fecha/firma`

export async function generateDocument(ctx: GenerationContext): Promise<string> {
  const client = getClient()

  const deadline = ctx.grant.deadline
    ? new Date(ctx.grant.deadline).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
    : 'No especificado'

  const foundingYear = ctx.company.founding_date
    ? new Date(ctx.company.founding_date).getFullYear()
    : 'No especificado'

  const intakeText = Object.entries(ctx.intake)
    .filter(([, v]) => v !== '' && v !== null && v !== undefined)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n')

  const userPrompt = `Genera el siguiente documento para una solicitud de subvención:

DOCUMENTO A GENERAR: ${ctx.documentName}
TIPO: ${ctx.documentType}
ESTRUCTURA/SECCIONES REQUERIDAS: ${ctx.templateHint || 'Estructura estándar para este tipo de documento en subvenciones españolas'}

---
DATOS DE LA CONVOCATORIA:
- Título: ${ctx.grant.title}
- Organismo convocante: ${ctx.grant.organismo ?? 'No especificado'}
- Tipo de ayuda: ${ctx.grant.grant_type} · ${ctx.grant.scope}
- Plazo solicitud: ${deadline}
- Importe solicitado: ${ctx.requestedAmount ? `${ctx.requestedAmount.toLocaleString('es-ES')} €` : 'Por determinar'}
- Descripción: ${ctx.grant.summary ?? ''}
- Texto oficial: ${ctx.grant.body?.slice(0, 800) ?? ''}

---
DATOS DE LA EMPRESA:
- Nombre: ${ctx.company.name}
- CIF: ${ctx.company.cif}
- Comunidad Autónoma: ${ctx.company.region ?? 'No especificada'}
- Municipio: ${ctx.company.municipality ?? 'No especificado'}
- Empleados: ${ctx.company.employees_count}
- Facturación anual: ${ctx.company.revenue_annual.toLocaleString('es-ES')} €
- Año de constitución: ${foundingYear}
- Startup: ${ctx.company.is_startup ? 'Sí' : 'No'}
- I+D: ${ctx.company.has_rd ? 'Sí' : 'No'}
- CNAE: ${ctx.company.cnae_primary ?? 'No especificado'}
- Web: ${ctx.company.website ?? 'No especificada'}

---
INFORMACIÓN ADICIONAL APORTADA POR LA EMPRESA:
${intakeText || '(Sin información adicional)'}

---
Genera el documento completo en Markdown, listo para presentar. Incluye todos los apartados especificados y usa los datos reales de la empresa. El documento debe ser formal, técnico y convincente.`

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: DOC_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.3,
    max_tokens: 3000,
  })

  const content = response.choices[0]?.message?.content
  if (!content) throw new Error('Empty response from OpenAI')
  return content
}
