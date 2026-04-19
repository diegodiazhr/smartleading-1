'use client'

import { useState } from 'react'
import type { GuideDocument } from '@/lib/application-guide'
import { INTAKE_FIELDS } from '@/lib/document-generator'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Sparkles, Download, Edit3, CheckCircle2, Loader2,
  AlertTriangle, X, ChevronLeft, Copy, Check,
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

type Stage = 'idle' | 'intake' | 'generating' | 'view' | 'edit'

export default function DocumentGeneratorPanel({ applicationId, companyName, doc, stored: initialStored }: Props) {
  const [stage, setStage] = useState<Stage>(initialStored ? 'view' : 'idle')
  const [stored, setStored] = useState<StoredDoc | null>(initialStored)
  const [intake, setIntake] = useState<Record<string, string>>({})
  const [content, setContent] = useState(initialStored?.content ?? '')
  const [editContent, setEditContent] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)

  const fields = INTAKE_FIELDS[doc.document_type ?? 'other_generated'] ?? []
  const requiredFields = fields.filter(f => f.required)
  const canGenerate = requiredFields.every(f => (intake[f.key] ?? '').trim().length > 0)

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
          intake,
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

  // ── IDLE: just the "Generar" button ──
  if (stage === 'idle') {
    return (
      <Button
        size="sm"
        onClick={() => setStage(fields.length > 0 ? 'intake' : 'generating')}
        className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white"
      >
        <Sparkles className="w-3.5 h-3.5" />
        Generar con IA
      </Button>
    )
  }

  // ── INTAKE: form to collect missing info ──
  if (stage === 'intake') {
    return (
      <div className="mt-3 border border-indigo-200 rounded-xl bg-indigo-50/40 p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-600" />
            <p className="text-sm font-semibold text-gray-900">Generar: {doc.name}</p>
          </div>
          <button onClick={() => setStage('idle')} className="text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-gray-500">
          Necesitamos algunos datos para generar el documento personalizado para tu empresa y esta subvención específica.
          Los datos del perfil de empresa ya están incluidos automáticamente.
        </p>

        <div className="space-y-3">
          {fields.map(field => (
            <div key={field.key}>
              <label className="text-xs font-medium text-gray-700 block mb-1">
                {field.label}
                {field.required && <span className="text-red-500 ml-1">*</span>}
              </label>
              {field.type === 'textarea' ? (
                <textarea
                  value={intake[field.key] ?? ''}
                  onChange={e => setIntake(prev => ({ ...prev, [field.key]: e.target.value }))}
                  placeholder={field.placeholder}
                  rows={3}
                  className="w-full text-sm rounded-lg border border-gray-200 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              ) : field.type === 'select' ? (
                <select
                  value={intake[field.key] ?? ''}
                  onChange={e => setIntake(prev => ({ ...prev, [field.key]: e.target.value }))}
                  className="w-full h-9 text-sm rounded-lg border border-gray-200 bg-white px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Selecciona…</option>
                  {field.options?.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              ) : (
                <Input
                  type={field.type}
                  value={intake[field.key] ?? ''}
                  onChange={e => setIntake(prev => ({ ...prev, [field.key]: e.target.value }))}
                  placeholder={field.placeholder}
                />
              )}
              {field.hint && <p className="text-xs text-indigo-600 mt-1">{field.hint}</p>}
            </div>
          ))}
        </div>

        {error && (
          <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            {error}
          </div>
        )}

        <div className="flex gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={() => setStage('idle')}>Cancelar</Button>
          <Button
            size="sm"
            onClick={handleGenerate}
            disabled={!canGenerate}
            className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Generar documento
          </Button>
        </div>
      </div>
    )
  }

  // ── GENERATING ──
  if (stage === 'generating') {
    return (
      <div className="mt-3 border border-indigo-200 rounded-xl bg-indigo-50/40 p-6 flex flex-col items-center gap-3 text-center">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        <p className="text-sm font-medium text-gray-900">Generando {doc.name}…</p>
        <p className="text-xs text-gray-500">La IA está redactando el documento adaptado a tu empresa y esta convocatoria.</p>
      </div>
    )
  }

  // ── VIEW: rendered document ──
  if (stage === 'view') {
    return (
      <div className="mt-3 border border-gray-200 rounded-xl bg-white overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span className="text-xs font-medium text-gray-700">{doc.name}</span>
            {stored?.version && (
              <span className="text-xs text-gray-400">v{stored.version}</span>
            )}
          </div>
          <div className="flex gap-1.5">
            <Button size="sm" variant="outline" onClick={handleCopy} className="gap-1 h-7 text-xs">
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copiado' : 'Copiar'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setEditContent(content); setStage('edit') }} className="gap-1 h-7 text-xs">
              <Edit3 className="w-3.5 h-3.5" />
              Editar
            </Button>
            <Button size="sm" variant="outline" onClick={handleDownload} className="gap-1 h-7 text-xs">
              <Download className="w-3.5 h-3.5" />
              .docx
            </Button>
            <Button size="sm" variant="outline" onClick={() => setStage('intake')} className="gap-1 h-7 text-xs text-indigo-600 border-indigo-200">
              <Sparkles className="w-3.5 h-3.5" />
              Regenerar
            </Button>
          </div>
        </div>

        {/* Document content rendered */}
        <div className="p-5 max-h-96 overflow-y-auto">
          <MarkdownPreview content={content} />
        </div>
      </div>
    )
  }

  // ── EDIT: textarea ──
  if (stage === 'edit') {
    return (
      <div className="mt-3 border border-gray-200 rounded-xl bg-white overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <button onClick={() => setStage('view')} className="text-gray-400 hover:text-gray-600">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-medium text-gray-700">Editando: {doc.name}</span>
          </div>
          <div className="flex gap-1.5">
            <Button size="sm" variant="outline" onClick={() => setStage('view')} className="h-7 text-xs">Cancelar</Button>
            <Button size="sm" onClick={handleSaveEdit} disabled={saving} className="h-7 text-xs gap-1 bg-indigo-600 hover:bg-indigo-700 text-white">
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
              Guardar
            </Button>
          </div>
        </div>
        <textarea
          value={editContent}
          onChange={e => setEditContent(e.target.value)}
          className="w-full h-80 p-4 text-sm font-mono resize-none focus:outline-none border-0"
        />
      </div>
    )
  }

  return null
}

function MarkdownPreview({ content }: { content: string }) {
  const lines = content.split('\n')
  return (
    <div className="prose prose-sm max-w-none text-gray-800">
      {lines.map((line, i) => {
        const trimmed = line.trim()
        if (trimmed.startsWith('# ')) return <h1 key={i} className="text-lg font-bold mt-4 mb-2 text-gray-900">{trimmed.slice(2)}</h1>
        if (trimmed.startsWith('## ')) return <h2 key={i} className="text-base font-semibold mt-3 mb-1.5 text-gray-900 border-b pb-1">{trimmed.slice(3)}</h2>
        if (trimmed.startsWith('### ')) return <h3 key={i} className="text-sm font-semibold mt-2 mb-1 text-gray-800">{trimmed.slice(4)}</h3>
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          return <li key={i} className="text-sm ml-4 mb-0.5">{trimmed.slice(2)}</li>
        }
        if (trimmed === '' || trimmed === '---') return <div key={i} className="my-2" />
        // Inline bold
        const parts = trimmed.split(/(\*\*[^*]+\*\*)/)
        return (
          <p key={i} className="text-sm mb-1 leading-relaxed">
            {parts.map((part, j) =>
              part.startsWith('**') && part.endsWith('**')
                ? <strong key={j}>{part.slice(2, -2)}</strong>
                : part
            )}
          </p>
        )
      })}
    </div>
  )
}
