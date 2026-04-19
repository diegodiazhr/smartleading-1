'use client'

import { useState } from 'react'
import { RefreshCw, Zap, Sparkles } from 'lucide-react'

type RunState = 'idle' | 'running' | 'ok' | 'error'

interface OpResult {
  state: RunState
  summary?: string
  error?: string
}

function OpCard({
  icon: Icon,
  title,
  description,
  buttonLabel,
  onRun,
  result,
}: {
  icon: React.ElementType
  title: string
  description: string
  buttonLabel: string
  onRun: () => void
  result: OpResult
}) {
  return (
    <div style={{
      padding: '20px 24px',
      background: 'var(--bg)',
      border: `1px solid ${result.state === 'ok' ? 'var(--good)' : result.state === 'error' ? 'var(--danger)' : 'var(--line)'}`,
      borderRadius: 12,
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: 'var(--accent-soft)', color: 'var(--accent-ink)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Icon size={18} strokeWidth={1.75} />
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--fg)' }}>{title}</div>
          <div style={{ fontSize: 12.5, color: 'var(--fg-3)', marginTop: 3, lineHeight: 1.5 }}>{description}</div>
        </div>
      </div>

      <button
        onClick={onRun}
        disabled={result.state === 'running'}
        style={{
          padding: '8px 18px',
          borderRadius: 8,
          border: '1px solid var(--line)',
          background: result.state === 'running' ? 'var(--bg-2)' : 'var(--fg)',
          color: result.state === 'running' ? 'var(--fg-3)' : 'var(--bg)',
          fontSize: 13,
          fontWeight: 500,
          cursor: result.state === 'running' ? 'not-allowed' : 'pointer',
          alignSelf: 'flex-start',
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          transition: 'all .12s ease',
        }}
      >
        {result.state === 'running' && (
          <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} />
        )}
        {result.state === 'running' ? 'Ejecutando...' : buttonLabel}
      </button>

      {result.state === 'ok' && result.summary && (
        <pre style={{
          margin: 0, padding: '12px 14px',
          background: 'var(--good-soft)', border: '1px solid var(--good)',
          borderRadius: 8, fontSize: 11.5, color: 'var(--fg-2)',
          fontFamily: 'var(--font-geist-mono)', whiteSpace: 'pre-wrap', lineHeight: 1.6,
        }}>{result.summary}</pre>
      )}
      {result.state === 'error' && (
        <div style={{
          padding: '10px 14px', background: 'color-mix(in oklch, var(--danger) 12%, transparent)',
          border: '1px solid var(--danger)', borderRadius: 8,
          fontSize: 12.5, color: 'var(--danger)',
        }}>{result.error}</div>
      )}
    </div>
  )
}

export function OperacionesPanel() {
  const [sync, setSync] = useState<OpResult>({ state: 'idle' })
  const [matching, setMatching] = useState<OpResult>({ state: 'idle' })
  const [enrich, setEnrich] = useState<OpResult>({ state: 'idle' })

  async function runOp(
    setter: (r: OpResult) => void,
    apiPath: string,
    body?: object,
    summarize?: (data: Record<string, unknown>) => string,
  ) {
    setter({ state: 'running' })
    try {
      const res = await fetch(apiPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      })
      const data = await res.json()
      if (data.ok || res.ok) {
        setter({ state: 'ok', summary: summarize ? summarize(data) : JSON.stringify(data.stats ?? data, null, 2) })
      } else {
        setter({ state: 'error', error: data.error ?? 'Error desconocido' })
      }
    } catch (e) {
      setter({ state: 'error', error: String(e) })
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 600 }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <OpCard
        icon={RefreshCw}
        title="Sincronizar BDNS"
        description="Descarga las últimas convocatorias del BDNS y actualiza la base de datos. Incluye parsing de tipos de beneficiarios para filtrado preciso."
        buttonLabel="Lanzar sync"
        result={sync}
        onRun={() => runOp(setSync, '/api/admin/sync-bdns', { maxPagesPerVpd: 20 }, (d) => {
          const s = d.stats as Record<string, unknown>
          return `✓ ${s?.totalGrantsUpserted ?? '?'} convocatorias actualizadas\n${s?.totalPagesProcessed ?? '?'} páginas procesadas\n${s?.durationMs ?? '?'} ms`
        })}
      />

      <OpCard
        icon={Zap}
        title="Re-calcular matching"
        description="Recalcula las puntuaciones de afinidad entre todas las empresas y convocatorias activas. Actualiza exclusiones duras, sector, CNAE y región."
        buttonLabel="Calcular para todas las empresas"
        result={matching}
        onRun={() => runOp(setMatching, '/api/admin/run-matching-all', undefined, (d) => {
          const results = d.results as Array<{ name: string; ok: boolean; stats?: { totalGrants: number; matched: number; highFit: number; totalPotential: number } }>
          return results.map(r =>
            r.ok
              ? `✓ ${r.name}\n  ${r.stats?.matched ?? 0} matches · ${r.stats?.highFit ?? 0} alta afinidad`
              : `✗ ${r.name}: ${(r as unknown as Record<string, unknown>).error}`
          ).join('\n\n')
        })}
      />

      <OpCard
        icon={Sparkles}
        title="Enriquecer convocatorias"
        description="Usa IA para mejorar los títulos y resúmenes de las últimas 200 convocatorias con datos incompletos o poco descriptivos."
        buttonLabel="Enriquecer con IA"
        result={enrich}
        onRun={() => runOp(setEnrich, '/api/admin/enrich-grants', undefined, (d) => {
          const s = d.stats as Record<string, unknown>
          return `✓ ${s?.enriched ?? '?'} enriquecidas\n✗ ${s?.failed ?? '?'} fallidas\n${s?.durationMs ?? '?'} ms`
        })}
      />
    </div>
  )
}
