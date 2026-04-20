'use client'

import { useState, useRef, useCallback } from 'react'
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, X, Loader2 } from 'lucide-react'

type Status = 'idle' | 'uploading' | 'done' | 'error'

interface ImportStats {
  total: number
  parsed: number
  inserted: number
  skipped: number
  insertErrors: number
  parseErrors: number
}

interface ImportResult {
  ok: boolean
  stats?: ImportStats
  error?: string
  parseErrors?: string[]
  errorDetails?: string[]
}

export function ImportPanel() {
  const [status, setStatus] = useState<Status>('idle')
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFile(f: File) {
    setFile(f)
    setResult(null)
    setStatus('idle')
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }, [])

  async function handleImport() {
    if (!file) return
    setStatus('uploading')
    setResult(null)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch('/api/admin/import-grants', {
        method: 'POST',
        body: formData,
      })
      const data: ImportResult = await res.json()
      setResult(data)
      setStatus(data.ok ? 'done' : 'error')
    } catch (e) {
      setResult({ ok: false, error: String(e) })
      setStatus('error')
    }
  }

  function reset() {
    setFile(null)
    setResult(null)
    setStatus('idle')
    if (inputRef.current) inputRef.current.value = ''
  }

  const fmt = (n: number) => n.toLocaleString('es-ES')

  return (
    <div style={{ maxWidth: 640 }}>

      {/* Format reference */}
      <div style={{
        padding: '14px 18px', marginBottom: 20,
        background: 'var(--bg-2)', border: '1px solid var(--line)',
        borderRadius: 10,
      }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg)', marginBottom: 8 }}>
          Formato esperado del fichero
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[
            'Código BDNS',
            'Mecanismo de Recuperación y Resiliencia',
            'Administración',
            'Departamento',
            'Órgano',
            'Fecha de registro',
            'Título de la convocatoria',
          ].map((col, i) => (
            <span key={col} style={{
              fontSize: 11, padding: '3px 8px', borderRadius: 6,
              background: i === 0 ? 'var(--accent-soft)' : 'var(--bg-3)',
              color: i === 0 ? 'var(--accent-ink)' : 'var(--fg-3)',
              border: `1px solid ${i === 0 ? 'var(--accent-soft-2)' : 'var(--line)'}`,
              fontFamily: 'var(--font-geist-mono)',
            }}>
              {i === 0 && '🔑 '}{col}
            </span>
          ))}
        </div>
        <div style={{ fontSize: 11, color: 'var(--fg-4)', marginTop: 8 }}>
          La primera fila debe ser la cabecera. Formatos: .xlsx, .xls, .csv · Fechas en DD/MM/YYYY
        </div>
      </div>

      {/* Drop zone */}
      <div
        onDrop={onDrop}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onClick={() => !file && inputRef.current?.click()}
        style={{
          padding: '36px 24px',
          border: `2px dashed ${dragging ? 'var(--accent)' : file ? 'var(--good)' : 'var(--line-2)'}`,
          borderRadius: 12,
          background: dragging ? 'var(--accent-soft)' : file ? 'var(--good-soft)' : 'var(--bg-2)',
          cursor: file ? 'default' : 'pointer',
          textAlign: 'center',
          transition: 'all .15s ease',
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
        />

        {file ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <FileSpreadsheet size={28} style={{ color: 'var(--good)', flexShrink: 0 }} />
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--fg)' }}>{file.name}</div>
              <div style={{ fontSize: 12, color: 'var(--fg-4)', marginTop: 2 }}>
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </div>
            </div>
            <button
              onClick={e => { e.stopPropagation(); reset() }}
              style={{
                marginLeft: 8, background: 'none', border: 'none',
                cursor: 'pointer', color: 'var(--fg-4)', padding: 4,
              }}
            >
              <X size={16} />
            </button>
          </div>
        ) : (
          <>
            <Upload size={28} style={{ color: 'var(--fg-4)', marginBottom: 10 }} />
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--fg)' }}>
              Arrastra el fichero aquí o haz clic para seleccionarlo
            </div>
            <div style={{ fontSize: 12, color: 'var(--fg-4)', marginTop: 6 }}>
              .xlsx · .xls · .csv — sin límite de filas
            </div>
          </>
        )}
      </div>

      {/* Import button */}
      {file && status !== 'uploading' && !result && (
        <button
          onClick={handleImport}
          style={{
            marginTop: 16, width: '100%',
            padding: '11px 0', borderRadius: 10,
            background: 'var(--fg)', color: 'var(--bg)',
            border: 'none', fontSize: 14, fontWeight: 500,
            cursor: 'pointer', display: 'flex', alignItems: 'center',
            justifyContent: 'center', gap: 8, transition: 'opacity .12s',
          }}
        >
          <Upload size={15} />
          Importar convocatorias
        </button>
      )}

      {/* Uploading state */}
      {status === 'uploading' && (
        <div style={{
          marginTop: 16, padding: '20px', borderRadius: 10,
          background: 'var(--bg-2)', border: '1px solid var(--line)',
          display: 'flex', alignItems: 'center', gap: 14,
        }}>
          <Loader2 size={20} style={{ color: 'var(--accent)', animation: 'spin 1s linear infinite', flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--fg)' }}>
              Procesando fichero…
            </div>
            <div style={{ fontSize: 12, color: 'var(--fg-4)', marginTop: 3 }}>
              Analizando filas, detectando duplicados e importando. Puede tardar hasta 30 segundos para 10.000 filas.
            </div>
          </div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Result */}
      {result && (
        <div style={{
          marginTop: 16, borderRadius: 10, overflow: 'hidden',
          border: `1px solid ${result.ok ? 'var(--good)' : 'var(--danger)'}`,
        }}>
          {/* Header */}
          <div style={{
            padding: '12px 18px',
            background: result.ok ? 'var(--good-soft)' : 'color-mix(in oklch, var(--danger) 10%, transparent)',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            {result.ok
              ? <CheckCircle2 size={18} style={{ color: 'var(--good)' }} />
              : <AlertTriangle size={18} style={{ color: 'var(--danger)' }} />
            }
            <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--fg)' }}>
              {result.ok ? 'Importación completada' : 'Error en la importación'}
            </span>
          </div>

          <div style={{ padding: '16px 18px', background: 'var(--bg)', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {result.error && (
              <div style={{ fontSize: 13, color: 'var(--danger)' }}>{result.error}</div>
            )}

            {result.stats && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                {[
                  { label: 'Total filas', value: result.stats.total, color: 'var(--fg)' },
                  { label: 'Válidas', value: result.stats.parsed, color: 'var(--fg)' },
                  { label: 'Insertadas ✓', value: result.stats.inserted, color: 'var(--good)' },
                  { label: 'Ya existían', value: result.stats.skipped, color: 'var(--fg-3)' },
                  { label: 'Errores fila', value: result.stats.parseErrors, color: result.stats.parseErrors > 0 ? 'var(--warn)' : 'var(--fg-4)' },
                  { label: 'Errores insert', value: result.stats.insertErrors, color: result.stats.insertErrors > 0 ? 'var(--danger)' : 'var(--fg-4)' },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{
                    padding: '10px 12px', borderRadius: 8,
                    background: 'var(--bg-2)', border: '1px solid var(--line)',
                    textAlign: 'center',
                  }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color, fontFamily: 'var(--font-geist-mono)' }}>
                      {fmt(value)}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--fg-4)', marginTop: 3 }}>{label}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Parse errors sample */}
            {(result.parseErrors?.length ?? 0) > 0 && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--warn)', marginBottom: 6 }}>
                  Filas omitidas (muestra):
                </div>
                {result.parseErrors!.map((e, i) => (
                  <div key={i} style={{
                    fontSize: 11.5, color: 'var(--fg-3)', padding: '3px 0',
                    borderBottom: '1px solid var(--line)', fontFamily: 'var(--font-geist-mono)',
                  }}>{e}</div>
                ))}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button
                onClick={reset}
                style={{
                  padding: '7px 16px', borderRadius: 8,
                  border: '1px solid var(--line)', background: 'var(--bg-2)',
                  color: 'var(--fg-2)', fontSize: 13, cursor: 'pointer',
                }}
              >
                Importar otro fichero
              </button>
              {result.ok && result.stats && result.stats.inserted > 0 && (
                <a
                  href="/admin/operaciones"
                  style={{
                    padding: '7px 16px', borderRadius: 8,
                    background: 'var(--fg)', color: 'var(--bg)',
                    fontSize: 13, fontWeight: 500, textDecoration: 'none',
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                  }}
                >
                  Recalcular matching →
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
