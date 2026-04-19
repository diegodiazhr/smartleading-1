'use client'

import { useState, useOptimistic, useTransition } from 'react'
import type { ApplicationGuide, GuideStep, GuideDocument } from '@/lib/application-guide'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  CheckCircle2,
  Circle,
  FileText,
  Zap,
  Send,
  ShieldCheck,
  AlertTriangle,
  Clock,
  ChevronDown,
  ChevronRight,
  BookOpen,
  Sparkles,
} from 'lucide-react'

const STEP_ICONS: Record<string, React.ElementType> = {
  document: FileText,
  action: Zap,
  submission: Send,
  verification: ShieldCheck,
}

const STEP_COLORS: Record<string, string> = {
  document: 'text-blue-600 bg-blue-50 border-blue-200',
  action: 'text-amber-600 bg-amber-50 border-amber-200',
  submission: 'text-indigo-600 bg-indigo-50 border-indigo-200',
  verification: 'text-emerald-600 bg-emerald-50 border-emerald-200',
}

interface Props {
  applicationId: string
  guide: ApplicationGuide
  completedItems: string[]
}

export default function ApplicationGuideComponent({ applicationId, guide, completedItems: initial }: Props) {
  const [, startTransition] = useTransition()
  const [optimisticCompleted, setOptimisticCompleted] = useOptimistic(initial)
  const [expandedStep, setExpandedStep] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'steps' | 'documents'>('steps')

  const totalItems = guide.steps.length + guide.documents.length
  const completedCount = optimisticCompleted.length
  const progressPct = totalItems > 0 ? Math.round((completedCount / totalItems) * 100) : 0

  async function toggle(itemId: string) {
    const isCompleted = optimisticCompleted.includes(itemId)
    startTransition(async () => {
      setOptimisticCompleted(prev =>
        isCompleted ? prev.filter(i => i !== itemId) : [...prev, itemId]
      )
      await fetch(`/api/applications/${applicationId}/progress`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: itemId, completed: !isCompleted }),
      })
    })
  }

  return (
    <div className="space-y-4">
      {/* Progress header */}
      <Card className="border-indigo-100 bg-gradient-to-br from-indigo-50 to-white">
        <CardContent className="p-5">
          <div className="flex items-center gap-3 mb-3">
            <Sparkles className="w-5 h-5 text-indigo-600" />
            <div>
              <h3 className="font-semibold text-gray-900 text-sm">Guía de presentación</h3>
              <p className="text-xs text-gray-500">Generada por IA a partir del contexto de la subvención</p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-2xl font-bold text-indigo-700">{progressPct}%</p>
              <p className="text-xs text-gray-400">{completedCount}/{totalItems} completados</p>
            </div>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-600 rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>

          {/* Meta info */}
          <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              ~{guide.estimated_total_days} días de preparación
            </span>
            <span>·</span>
            <span>{guide.submission_channel}</span>
          </div>
        </CardContent>
      </Card>

      {/* Warnings */}
      {guide.warnings.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-amber-900 mb-1.5">Avisos importantes</p>
                <ul className="space-y-1">
                  {guide.warnings.map((w, i) => (
                    <li key={i} className="text-xs text-amber-800 flex gap-1.5">
                      <span className="shrink-0">•</span>
                      {w}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
        <button
          onClick={() => setActiveTab('steps')}
          className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors flex items-center justify-center gap-1.5 ${
            activeTab === 'steps' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Zap className="w-3.5 h-3.5" />
          Pasos ({guide.steps.length})
        </button>
        <button
          onClick={() => setActiveTab('documents')}
          className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors flex items-center justify-center gap-1.5 ${
            activeTab === 'documents' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          Documentos ({guide.documents.length})
        </button>
      </div>

      {/* Steps tab */}
      {activeTab === 'steps' && (
        <div className="space-y-2">
          {guide.steps.map((step) => (
            <StepCard
              key={step.id}
              step={step}
              completed={optimisticCompleted.includes(step.id)}
              expanded={expandedStep === step.id}
              onToggleExpand={() => setExpandedStep(expandedStep === step.id ? null : step.id)}
              onToggleComplete={() => toggle(step.id)}
            />
          ))}
        </div>
      )}

      {/* Documents tab */}
      {activeTab === 'documents' && (
        <div className="space-y-2">
          {/* Key requirements */}
          {guide.key_requirements.length > 0 && (
            <Card className="border-gray-200">
              <CardContent className="p-3">
                <p className="text-xs font-semibold text-gray-700 flex items-center gap-1.5 mb-2">
                  <BookOpen className="w-3.5 h-3.5 text-indigo-500" />
                  Requisitos clave de elegibilidad
                </p>
                <ul className="space-y-1">
                  {guide.key_requirements.map((req, i) => (
                    <li key={i} className="text-xs text-gray-600 flex gap-1.5">
                      <ChevronRight className="w-3 h-3 text-indigo-400 shrink-0 mt-0.5" />
                      {req}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {guide.documents.map((doc) => (
            <DocumentCard
              key={doc.id}
              doc={doc}
              completed={optimisticCompleted.includes(doc.id)}
              onToggle={() => toggle(doc.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function StepCard({
  step,
  completed,
  expanded,
  onToggleExpand,
  onToggleComplete,
}: {
  step: GuideStep
  completed: boolean
  expanded: boolean
  onToggleExpand: () => void
  onToggleComplete: () => void
}) {
  const Icon = STEP_ICONS[step.type] ?? Zap
  const colorClass = STEP_COLORS[step.type] ?? 'text-gray-600 bg-gray-50 border-gray-200'

  return (
    <div className={`rounded-lg border transition-all ${completed ? 'border-gray-200 bg-gray-50 opacity-75' : 'border-gray-200 bg-white hover:border-indigo-200'}`}>
      <div className="flex items-start gap-3 p-3">
        {/* Checkbox */}
        <button
          onClick={onToggleComplete}
          className="mt-0.5 shrink-0 transition-transform hover:scale-110"
          title={completed ? 'Marcar como pendiente' : 'Marcar como completado'}
        >
          {completed
            ? <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            : <Circle className="w-5 h-5 text-gray-300 hover:text-indigo-400" />
          }
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-400 font-mono">{step.order.toString().padStart(2, '0')}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${colorClass}`}>
              <Icon className="w-3 h-3 inline mr-1" />
              {step.type === 'document' ? 'Documento' : step.type === 'action' ? 'Acción' : step.type === 'submission' ? 'Envío' : 'Verificación'}
            </span>
            {step.estimated_days && (
              <span className="text-xs text-gray-400 flex items-center gap-0.5">
                <Clock className="w-3 h-3" />{step.estimated_days}d
              </span>
            )}
            {!step.required && <span className="text-xs text-gray-400 italic">opcional</span>}
          </div>
          <p className={`text-sm font-medium mt-1 ${completed ? 'line-through text-gray-400' : 'text-gray-900'}`}>
            {step.title}
          </p>
        </div>

        {/* Expand toggle */}
        <button onClick={onToggleExpand} className="shrink-0 text-gray-400 hover:text-gray-600 mt-0.5">
          {expanded
            ? <ChevronDown className="w-4 h-4" />
            : <ChevronRight className="w-4 h-4" />
          }
        </button>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-3 space-y-2 border-t border-gray-100 pt-2.5">
          <p className="text-sm text-gray-600">{step.description}</p>
          {step.tip && (
            <div className="flex items-start gap-1.5 text-xs text-indigo-700 bg-indigo-50 rounded p-2">
              <Sparkles className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{step.tip}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function DocumentCard({
  doc,
  completed,
  onToggle,
}: {
  doc: GuideDocument
  completed: boolean
  onToggle: () => void
}) {
  return (
    <div className={`rounded-lg border p-3 flex items-start gap-3 transition-all ${
      completed ? 'border-gray-200 bg-gray-50 opacity-75' : 'border-gray-200 bg-white hover:border-indigo-200'
    }`}>
      <button onClick={onToggle} className="mt-0.5 shrink-0 transition-transform hover:scale-110">
        {completed
          ? <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          : <Circle className="w-5 h-5 text-gray-300 hover:text-indigo-400" />
        }
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className={`text-sm font-medium ${completed ? 'line-through text-gray-400' : 'text-gray-900'}`}>
            {doc.name}
          </p>
          {!doc.required && <span className="text-xs text-gray-400 italic">opcional</span>}
          {doc.format && (
            <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{doc.format}</span>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-0.5">{doc.description}</p>
        <p className="text-xs text-indigo-600 mt-1 flex items-center gap-1">
          <BookOpen className="w-3 h-3" />
          {doc.where_to_get}
        </p>
      </div>
    </div>
  )
}
