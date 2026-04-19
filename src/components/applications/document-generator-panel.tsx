'use client'

import { useState } from 'react'
import type { GuideDocument } from '@/lib/application-guide'
import type { QuestionnaireQuestion } from '@/lib/document-generator'
import { Button } from '@/components/ui/button'
import {
  Sparkles, Download, Edit3, CheckCircle2, Loader2,
  AlertTriangle, X, ChevronLeft, Copy, Check, RefreshCw,
} from 'lucide-react'
import { generateDocx } from '@/lib/docx-export'

interface StoredDoc {
  content: string
  document_name: string
  generated_at: string
  version: number
  edited_at?: string
}

interface Props {
  applicationId: string
  companyName: string
  doc: GuideDocument
  stored: StoredDoc | null
}

type Stage = 'idle' | 'loading-questions' | 'intake' | 'generating' | 'view' | 'edit'

export default function DocumentGeneratorPanel({ applicationId, companyName, doc, stored: initialStored }: Props) {
  const [stage, setStage] = useState<Stage>(initialStored ? 'view' : 'idle')
  const [stored, setStored] = useState<StoredDoc | null>(initialStored)
  const [questions, setQuestions] = useState<QuestionnaireQuestion[]>([])
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [content, setContent] = useState(initialStored?.content ?? '')
  const [editContent, setEditContent] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)

  const requiredQuestions = questions.filter(q => q.required)
  const canGenerate = requiredQuestions.every(q => (answers[q.id] ?? '').trim().length > 0)

  async function handleStartQuestionnaire() {
    setStage('loading-questions')
    setError(null)
    try {
      const res = await fetch(`/api/applications/${applicationId}/documents/questionnaire`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document_name: doc.name,
          document_type: doc.document_type ?? 'other_generated',
          template_hint: doc.template_hint ?? '',
        }),
      })
      const data = await res.json() as { questions?: QuestionnaireQuestion[]; error?: string }
      if (!res.ok || !data.questions) {
        setError(data.error ?? 'Error al generar el cuestionario')
        setStage('idle')
        return
      }
      setQuestions(data.questions)
      setStage('intake')
    } catch {
      setError('Error de conexión al cargar el cuestionario')
      setStage('idle')
    }
  }

  async function handleGenerate() {
    setStage('generating')
    setError(null)
    try {
      const res = await fetch(`/api/applications/${applicationId}/documents/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doc_id: doc.id,
          document_name: doc.name,
          document_type: doc.document_type ?? 'other_generated',
          template_hint: doc.template_hint ?? '',
          intake: answers,
          questions,
        }),
      })
      const data = await res.json() as { content?: string; error?: string }
      if (!res.ok || !data.content) {
        setError(data.error ?? 'Error al generar el documento')
        setStage('intake')
        return
      }
      setContent(data.content)
      setStored({
        content: data.content,
        document_name: doc.name,
        generated_at: new Date().toISOString(),
        version: (stored?.version ?? 0) + 1,
      })
      setStage('view')
    } catch {
      setError('Error de conexión')
      setStage('intake')
    }
  }

  async function handleSaveEdit() {
    setSaving(true)
    try {
      await fetch(`/api/applications/${applicationId}/documents/${doc.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editContent }),
      })
      setContent(editContent)
      setStored(prev => prev ? { ...prev, content: editContent, edited_at: new Date().toISOString() } : null)
      setStage('view')
    } catch {
      setError('Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  async function handleDownload() {
    try {
      const blob = await generateDocx(content, doc.name, companyName)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${doc.name.replace(/\s+/g, '_')}.docx`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setError('Error al generar el archivo Word')
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function setAnswer(id: string, value: string) {
    setAnswers(prev => ({ ...prev, [id]: value }))
  }

  // ── IDLE ──────────────────────────────────────────────────────────────────
  if (stage === 'idle') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button
          onClick={handleStartQuestionnaire}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            padding: '7px 14px', borderRadius: 8,
            background: 'var(--accent)', color: 'var(--bg)',
            border: 'none', fontSize: 13, fontWeight: 500, cursor: 'pointer',
            alignSelf: 'flex-start',
          }}
        >
          <Sparkles size={14} strokeWidth={1.75} />
          Generar con IA
        </button>
        {error && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 12, color: 'var(--danger)',
            padding: '6px 10px', borderRadius: 7,
            background: 'color-mix(in oklch, var(--danger) 10%, transparent)',
            border: '1px solid color-mix(in oklch, var(--danger) 25%, transparent)',
          }}>
            <AlertTriangle size={13} />
            {error}
          </div>
        )}
      </div>
    )
  }

  // ── LOADING QUESTIONS ───────────────────────────────────────────────���─────
  if (stage === 'loading-questions') {
    return (
      <div style={{
        marginTop: 12, padding: '24px 20px',
        border: '1px solid var(--line)', borderRadius: 12,
        background: 'var(--bg-2)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center',
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: 'var(--accent-soft)', color: 'var(--accent-ink)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
        </div>
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--fg)' }}>
            Preparando el cuestionario…
          </div>
          <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 4, lineHeight: 1.5 }}>
            La IA está analizando la convocatoria para saber exactamente qué información necesita para redactar el documento.
          </div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  // ── INTAKE: AI-generated questionnaire ───────────────────────────────────
  if (stage === 'intake') {
    const answered = questions.filter(q => (answers[q.id] ?? '').trim().length > 0).length
    const total = questions.length

    return (
      <div style={{
        marginTop: 12, border: '1px solid var(--line)',
        borderRadius: 12, overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '14px 18px', background: 'var(--bg-2)',
          borderBottom: '1px solid var(--line)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 7,
              background: 'var(--accent-soft)', color: 'var(--accent-ink)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Sparkles size={13} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg)' }}>{doc.name}</div>
              <div style={{ fontSize: 11, color: 'var(--fg-4)' }}>
                {answered}/{total} preguntas respondidas
              </div>
            </div>
          </div>
          <button
            onClick={() => { setStage('idle'); setError(null) }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-3)', padding: 4 }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Progress bar */}
        <div style={{ height: 3, background: 'var(--bg-3)' }}>
          <div style={{
            height: '100%',
            width: `${total > 0 ? (answered / total) * 100 : 0}%`,
            background: 'var(--accent)',
            transition: 'width .3s ease',
          }} />
        </div>

        {/* Questions */}
        <div style={{ padding: '18px 18px 0', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{
            fontSize: 12, color: 'var(--fg-3)', lineHeight: 1.5,
            padding: '10px 12px', background: 'var(--bg-3)',
            borderRadius: 8, borderLeft: '3px solid var(--accent-soft-2)',
          }}>
            Responde a estas preguntas para que la IA pueda redactar el documento con información real de tu empresa.
            Los datos del perfil de empresa (nombre, CIF, empleados, etc.) ya están incluidos automáticamente.
          </div>

          {questions.map((q, idx) => (
            <div key={q.id}>
              <label style={{
                display: 'block', fontSize: 13, fontWeight: 500,
                color: 'var(--fg)', marginBottom: 6,
              }}>
                <span style={{ color: 'var(--fg-4)', fontFamily: 'var(--font-geist-mono)', fontSize: 11, marginRight: 6 }}>
                  {idx + 1}.
                </span>
                {q.label}
                {q.required && <span style={{ color: 'var(--danger)', marginLeft: 3 }}>*</span>}
              </label>

              {q.type === 'textarea' ? (
                <textarea
                  value={answers[q.id] ?? ''}
                  onChange={e => setAnswer(q.id, e.target.value)}
                  placeholder={q.placeholder}
                  rows={4}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    fontSize: 13, lineHeight: 1.6,
                    padding: '10px 12px', borderRadius: 8,
                    border: `1px solid ${(answers[q.id] ?? '').trim() ? 'var(--accent-soft-2)' : 'var(--line)'}`,
                    background: 'var(--bg)',
                    color: 'var(--fg)',
                    resize: 'vertical',
                    outline: 'none',
                    fontFamily: 'inherit',
                    transition: 'border-color .12s ease',
                  }}
                />
              ) : q.type === 'select' ? (
                <select
                  value={answers[q.id] ?? ''}
                  onChange={e => setAnswer(q.id, e.target.value)}
                  style={{
                    width: '100%', height: 38, fontSize: 13,
                    padding: '0 12px', borderRadius: 8,
                    border: '1px solid var(--line)',
                    background: 'var(--bg)', color: 'var(--fg)',
                    outline: 'none', cursor: 'pointer',
                  }}
                >
                  <option value="">Selecciona una opción…</option>
                  {q.options?.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              ) : (
                <input
                  type={q.type}
                  value={answers[q.id] ?? ''}
                  onChange={e => setAnswer(q.id, e.target.value)}
                  placeholder={q.placeholder}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    height: 38, fontSize: 13,
                    padding: '0 12px', borderRadius: 8,
                    border: `1px solid ${(answers[q.id] ?? '').trim() ? 'var(--accent-soft-2)' : 'var(--line)'}`,
                    background: 'var(--bg)', color: 'var(--fg)',
                    outline: 'none', fontFamily: 'inherit',
                    transition: 'border-color .12s ease',
                  }}
                />
              )}

              {q.hint && (
                <div style={{ fontSize: 11.5, color: 'var(--fg-4)', marginTop: 5, lineHeight: 1.5 }}>
                  💡 {q.hint}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div style={{
            margin: '16px 18px 0',
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 12, color: 'var(--danger)',
            padding: '8px 12px', borderRadius: 8,
            background: 'color-mix(in oklch, var(--danger) 10%, transparent)',
            border: '1px solid color-mix(in oklch, var(--danger) 25%, transparent)',
          }}>
            <AlertTriangle size={13} />
            {error}
          </div>
        )}

        {/* Footer */}
        <div style={{
          padding: '16px 18px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginTop: 18, borderTop: '1px solid var(--line)',
          background: 'var(--bg-2)',
        }}>
          <div style={{ fontSize: 11.5, color: 'var(--fg-4)' }}>
            {requiredQuestions.length - requiredQuestions.filter(q => (answers[q.id] ?? '').trim().length > 0).length > 0
              ? `Faltan ${requiredQuestions.length - requiredQuestions.filter(q => (answers[q.id] ?? '').trim().length > 0).length} respuesta(s) obligatoria(s)`
              : '✓ Listo para generar'
            }
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => { setStage('idle'); setError(null) }}
              style={{
                padding: '7px 14px', borderRadius: 8,
                border: '1px solid var(--line)', background: 'var(--bg)',
                color: 'var(--fg-2)', fontSize: 13, cursor: 'pointer',
              }}
            >
              Cancelar
            </button>
            <button
              onClick={handleGenerate}
              disabled={!canGenerate}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                padding: '7px 16px', borderRadius: 8,
                background: canGenerate ? 'var(--accent)' : 'var(--bg-3)',
                color: canGenerate ? 'var(--bg)' : 'var(--fg-4)',
                border: 'none', fontSize: 13, fontWeight: 500,
                cursor: canGenerate ? 'pointer' : 'not-allowed',
                transition: 'all .12s ease',
              }}
            >
              <Sparkles size={14} />
              Generar documento
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── GENERATING ────────────────────────────────────────────────────────────
  if (stage === 'generating') {
    return (
      <div style={{
        marginTop: 12, padding: '32px 20px',
        border: '1px solid var(--line)', borderRadius: 12,
        background: 'var(--bg-2)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, textAlign: 'center',
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: 12,
          background: 'var(--accent-soft)', color: 'var(--accent-ink)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} />
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg)' }}>
            Redactando {doc.name}…
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--fg-3)', marginTop: 6, lineHeight: 1.6, maxWidth: 340 }}>
            La IA está redactando el documento con tus datos reales. Esto puede tardar hasta 30 segundos.
          </div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  // ── VIEW ──────────────────────────────────────────────────────────────────
  if (stage === 'view') {
    const hasPending = content.includes('[INFORMACIÓN PENDIENTE')
    return (
      <div style={{
        marginTop: 12, border: '1px solid var(--line)',
        borderRadius: 12, overflow: 'hidden',
        background: 'var(--bg)',
      }}>
        {/* Toolbar */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 14px', background: 'var(--bg-2)', borderBottom: '1px solid var(--line)',
          flexWrap: 'wrap', gap: 8,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CheckCircle2 size={15} style={{ color: 'var(--good)' }} />
            <span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--fg)' }}>{doc.name}</span>
            {stored?.version && (
              <span style={{
                fontSize: 10, padding: '1px 6px', borderRadius: 99,
                background: 'var(--bg-3)', color: 'var(--fg-4)',
                fontFamily: 'var(--font-geist-mono)',
              }}>v{stored.version}</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <ToolbarBtn onClick={handleCopy} icon={copied ? <Check size={13} style={{ color: 'var(--good)' }} /> : <Copy size={13} />}>
              {copied ? 'Copiado' : 'Copiar'}
            </ToolbarBtn>
            <ToolbarBtn onClick={() => { setEditContent(content); setStage('edit') }} icon={<Edit3 size={13} />}>
              Editar
            </ToolbarBtn>
            <ToolbarBtn onClick={handleDownload} icon={<Download size={13} />}>
              .docx
            </ToolbarBtn>
            <ToolbarBtn onClick={handleStartQuestionnaire} icon={<RefreshCw size={13} />} accent>
              Regenerar
            </ToolbarBtn>
          </div>
        </div>

        {/* Pending info warning */}
        {hasPending && (
          <div style={{
            margin: '0', padding: '10px 16px',
            background: 'color-mix(in oklch, var(--warn) 10%, transparent)',
            borderBottom: '1px solid color-mix(in oklch, var(--warn) 25%, transparent)',
            display: 'flex', alignItems: 'flex-start', gap: 8,
          }}>
            <AlertTriangle size={14} style={{ color: 'var(--warn)', flexShrink: 0, marginTop: 1 }} />
            <div style={{ fontSize: 12, color: 'var(--fg-2)', lineHeight: 1.5 }}>
              El documento contiene secciones marcadas como <strong>[INFORMACIÓN PENDIENTE]</strong>.
              Completa esa información manualmente o regenera el documento con más datos.
            </div>
          </div>
        )}

        {/* Document content */}
        <div style={{ padding: '20px 24px', maxHeight: 480, overflowY: 'auto' }}>
          <MarkdownPreview content={content} />
        </div>
      </div>
    )
  }

  // ── EDIT ──────────────────────────────────────────────────────────────────
  if (stage === 'edit') {
    return (
      <div style={{
        marginTop: 12, border: '1px solid var(--line)',
        borderRadius: 12, overflow: 'hidden', background: 'var(--bg)',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 14px', background: 'var(--bg-2)', borderBottom: '1px solid var(--line)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button onClick={() => setStage('view')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-3)', padding: 2 }}>
              <ChevronLeft size={16} />
            </button>
            <span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--fg)' }}>Editando: {doc.name}</span>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <ToolbarBtn onClick={() => setStage('view')}>Cancelar</ToolbarBtn>
            <button
              onClick={handleSaveEdit}
              disabled={saving}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '5px 12px', borderRadius: 7,
                background: 'var(--accent)', color: 'var(--bg)',
                border: 'none', fontSize: 12, fontWeight: 500, cursor: 'pointer',
              }}
            >
              {saving ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <CheckCircle2 size={11} />}
              Guardar
            </button>
          </div>
        </div>
        <textarea
          value={editContent}
          onChange={e => setEditContent(e.target.value)}
          style={{
            width: '100%', height: 400, padding: '16px 18px',
            fontSize: 13, fontFamily: 'var(--font-geist-mono)',
            lineHeight: 1.7, resize: 'vertical',
            border: 'none', outline: 'none',
            background: 'var(--bg)', color: 'var(--fg)',
            boxSizing: 'border-box',
          }}
        />
      </div>
    )
  }

  return null
}

// ── Toolbar button helper ─────────────────────────────────────────────────

function ToolbarBtn({
  children, onClick, icon, accent,
}: {
  children?: React.ReactNode
  onClick?: () => void
  icon?: React.ReactNode
  accent?: boolean
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '4px 10px', borderRadius: 7, cursor: 'pointer',
        border: `1px solid ${accent ? 'var(--accent-soft-2)' : 'var(--line)'}`,
        background: accent ? 'var(--accent-soft)' : 'var(--bg)',
        color: accent ? 'var(--accent-ink)' : 'var(--fg-2)',
        fontSize: 12, fontWeight: accent ? 500 : 400,
        transition: 'all .1s ease',
      }}
    >
      {icon}
      {children}
    </button>
  )
}

// ── Markdown renderer ─────────────────────────────────────────────────────

function MarkdownPreview({ content }: { content: string }) {
  const lines = content.split('\n')
  const elements: React.ReactNode[] = []
  let listBuffer: string[] = []

  function flushList() {
    if (listBuffer.length > 0) {
      elements.push(
        <ul key={`list-${elements.length}`} style={{ paddingLeft: 20, margin: '6px 0' }}>
          {listBuffer.map((item, i) => (
            <li key={i} style={{ fontSize: 13.5, lineHeight: 1.7, color: 'var(--fg-2)', marginBottom: 2 }}>
              {renderInline(item)}
            </li>
          ))}
        </ul>
      )
      listBuffer = []
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()

    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      listBuffer.push(trimmed.slice(2))
      continue
    }
    flushList()

    if (trimmed.startsWith('# ')) {
      elements.push(
        <h1 key={i} style={{ fontSize: 17, fontWeight: 700, color: 'var(--fg)', margin: '20px 0 8px', lineHeight: 1.3 }}>
          {renderInline(trimmed.slice(2))}
        </h1>
      )
    } else if (trimmed.startsWith('## ')) {
      elements.push(
        <h2 key={i} style={{
          fontSize: 14.5, fontWeight: 600, color: 'var(--fg)',
          margin: '18px 0 6px', paddingBottom: 6,
          borderBottom: '1px solid var(--line)',
        }}>
          {renderInline(trimmed.slice(3))}
        </h2>
      )
    } else if (trimmed.startsWith('### ')) {
      elements.push(
        <h3 key={i} style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--fg)', margin: '14px 0 4px' }}>
          {renderInline(trimmed.slice(4))}
        </h3>
      )
    } else if (trimmed === '---') {
      elements.push(<hr key={i} style={{ border: 'none', borderTop: '1px solid var(--line)', margin: '16px 0' }} />)
    } else if (trimmed === '') {
      elements.push(<div key={i} style={{ height: 6 }} />)
    } else if (trimmed.includes('[INFORMACIÓN PENDIENTE')) {
      // Highlight pending info sections
      elements.push(
        <div key={i} style={{
          padding: '8px 12px', margin: '6px 0',
          background: 'color-mix(in oklch, var(--warn) 10%, transparent)',
          border: '1px solid color-mix(in oklch, var(--warn) 30%, transparent)',
          borderRadius: 7, fontSize: 13, color: 'var(--fg-2)', lineHeight: 1.6,
        }}>
          {renderInline(trimmed)}
        </div>
      )
    } else {
      elements.push(
        <p key={i} style={{ fontSize: 13.5, lineHeight: 1.75, color: 'var(--fg-2)', margin: '4px 0' }}>
          {renderInline(trimmed)}
        </p>
      )
    }
  }
  flushList()

  return <div style={{ fontFamily: 'var(--font-geist)' }}>{elements}</div>
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\[INFORMACIÓN PENDIENTE:[^\]]+\])/)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} style={{ color: 'var(--fg)', fontWeight: 600 }}>{part.slice(2, -2)}</strong>
    }
    if (part.startsWith('[INFORMACIÓN PENDIENTE:')) {
      return (
        <span key={i} style={{
          background: 'color-mix(in oklch, var(--warn) 15%, transparent)',
          color: 'var(--warn)',
          borderRadius: 4, padding: '1px 5px',
          fontSize: '0.9em', fontWeight: 500,
        }}>
          {part}
        </span>
      )
    }
    return part
  })
}
