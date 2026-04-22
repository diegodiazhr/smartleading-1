export type GrantPublicationStatus = 'draft' | 'enriched' | 'published' | 'rejected'

export interface GrantQualitySignals {
  title: string | null
  summary: string | null
  officialSourceUrl: string | null
  beneficiaryTypes: string[]
  requirementsCount: number
  hasFunding: boolean
  hasTimeline: boolean
  evidenceCount: number
  hasPrimaryDocument: boolean
  hasSourceRecord: boolean
}

export interface GrantQualityCheck {
  key: string
  label: string
  passed: boolean
  detail: string
}

export interface GrantQualityEvaluation {
  qualityScore: number
  detailCompleteness: number
  publicationStatus: GrantPublicationStatus
  checklist: GrantQualityCheck[]
  rejectionReasons: string[]
}

function normalizeText(value: string | null | undefined) {
  return (value ?? '').replace(/\s+/g, ' ').trim()
}

function buildChecklist(signals: GrantQualitySignals): GrantQualityCheck[] {
  const title = normalizeText(signals.title)
  const summary = normalizeText(signals.summary)
  const titleReady = title.length >= 12
  const summaryReady = summary.length >= 80
  const officialSourceReady = Boolean(signals.officialSourceUrl)
  const beneficiaryReady = signals.beneficiaryTypes.length > 0
  const requirementsReady = signals.requirementsCount > 0
  const fundingReady = signals.hasFunding
  const timelineReady = signals.hasTimeline
  const evidenceReady = signals.evidenceCount >= 2

  return [
    {
      key: 'title',
      label: 'Título limpio',
      passed: titleReady,
      detail: titleReady ? title : 'Falta un título público suficientemente descriptivo.',
    },
    {
      key: 'summary',
      label: 'Resumen útil',
      passed: summaryReady,
      detail: summaryReady ? `${summary.length} caracteres útiles` : 'El resumen todavía es corto o poco informativo.',
    },
    {
      key: 'official_source',
      label: 'Fuente oficial',
      passed: officialSourceReady,
      detail: officialSourceReady ? (signals.officialSourceUrl as string) : 'No hay URL oficial preferida.',
    },
    {
      key: 'beneficiaries',
      label: 'Beneficiarios normalizados',
      passed: beneficiaryReady,
      detail: beneficiaryReady ? signals.beneficiaryTypes.join(', ') : 'No se han normalizado beneficiarios empresa/startup.',
    },
    {
      key: 'requirements',
      label: 'Requisitos concretos',
      passed: requirementsReady,
      detail: requirementsReady ? `${signals.requirementsCount} requisito(s) estructurado(s)` : 'No hay requisitos accionables estructurados.',
    },
    {
      key: 'funding',
      label: 'Importe o intensidad',
      passed: fundingReady,
      detail: fundingReady ? 'La convocatoria tiene condiciones económicas trazadas.' : 'No hay importes ni intensidad de ayuda.',
    },
    {
      key: 'timeline',
      label: 'Plazo o estado fiable',
      passed: timelineReady,
      detail: timelineReady ? 'Existe ventana temporal o estado verificable.' : 'Falta plazo o estado operativo.',
    },
    {
      key: 'evidence',
      label: 'Evidencia trazable',
      passed: evidenceReady,
      detail: evidenceReady
        ? `${signals.evidenceCount} evidencia(s) crítica(s) con soporte`
        : 'Todavía faltan evidencias suficientes para publicar con confianza.',
    },
  ]
}

export function evaluateGrantQuality(signals: GrantQualitySignals): GrantQualityEvaluation {
  const checklist = buildChecklist(signals)
  const passed = checklist.filter(item => item.passed).length
  const qualityScore = Number(((passed / checklist.length) * 100).toFixed(1))
  const detailNumerator = passed + (signals.hasPrimaryDocument ? 1 : 0) + (signals.hasSourceRecord ? 1 : 0)
  const detailCompleteness = Number(((detailNumerator / (checklist.length + 2)) * 100).toFixed(1))

  let publicationStatus: GrantPublicationStatus = 'draft'
  if (checklist.every(item => item.passed)) {
    publicationStatus = 'published'
  } else if (
    checklist.find(item => item.key === 'summary')?.passed &&
    checklist.find(item => item.key === 'official_source')?.passed &&
    passed >= 5
  ) {
    publicationStatus = 'enriched'
  } else if (!checklist.find(item => item.key === 'official_source')?.passed && passed <= 2) {
    publicationStatus = 'rejected'
  }

  const rejectionReasons = checklist
    .filter(item => !item.passed)
    .map(item => item.label)

  return {
    qualityScore,
    detailCompleteness,
    publicationStatus,
    checklist,
    rejectionReasons,
  }
}
