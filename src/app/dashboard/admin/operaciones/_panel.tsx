'use client'

import { useState } from 'react'
import { RefreshCw, Zap, Sparkles, GitBranch } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { AdminPill, AdminSectionCard } from '@/components/admin/admin-ui'

type RunState = 'idle' | 'running' | 'ok' | 'error'

interface OpResult {
  state: RunState
  summary?: string
  error?: string
}

interface OperationHistoryRow {
  id: string
  action: string
  status: 'info' | 'success' | 'error'
  target_label: string | null
  created_at: string
  metadata: Record<string, unknown> | null
}

function OpCard({
  icon: Icon,
  title,
  description,
  buttonLabel,
  confirmMessage,
  lastRun,
  onRun,
  result,
}: {
  icon: React.ElementType
  title: string
  description: string
  buttonLabel: string
  confirmMessage: string
  lastRun?: OperationHistoryRow
  onRun: () => void
  result: OpResult
}) {
  const lastRunMeta = lastRun?.metadata ?? {}

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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--fg)' }}>{title}</div>
            {lastRun && (
              <AdminPill tone={lastRun.status === 'error' ? 'danger' : 'good'}>
                Última {lastRun.status === 'error' ? 'con error' : 'correcta'}
              </AdminPill>
            )}
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--fg-3)', marginTop: 3, lineHeight: 1.5 }}>{description}</div>
          {lastRun && (
            <div style={{ fontSize: 11.5, color: 'var(--fg-4)', marginTop: 8 }}>
              {formatDate(lastRun.created_at)}
              {typeof lastRunMeta.durationMs === 'number' && ` · ${Math.round(Number(lastRunMeta.durationMs) / 1000)} s`}
            </div>
          )}
        </div>
      </div>

      <button
        onClick={() => {
          if (!window.confirm(confirmMessage)) return
          onRun()
        }}
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

export function OperacionesPanel({ history }: { history: OperationHistoryRow[] }) {
  const [pipeline, setPipeline] = useState<OpResult>({ state: 'idle' })
  const [sync, setSync] = useState<OpResult>({ state: 'idle' })
  const [matching, setMatching] = useState<OpResult>({ state: 'idle' })
  const [enrich, setEnrich] = useState<OpResult>({ state: 'idle' })

  const lastByAction = Object.fromEntries(
    ['sync_grant_sources', 'sync_bdns', 'run_matching_all', 'enrich_grants'].map(action => [
      action,
      history.find(item => item.action === action),
    ]),
  ) as Record<string, OperationHistoryRow | undefined>

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
    <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'minmax(0, 620px) minmax(320px, 1fr)', alignItems: 'start' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <OpCard
          icon={GitBranch}
          title="Sincronizar fuentes oficiales"
          description="Orquesta el pipeline oficial completo. Ejecuta BDNS de forma real y registra el resto de publishers para observabilidad del sistema."
          buttonLabel="Lanzar sync oficial"
          confirmMessage="Se lanzará la sincronización del pipeline oficial. ¿Quieres continuar?"
          lastRun={lastByAction.sync_grant_sources}
          result={pipeline}
          onRun={() => runOp(setPipeline, '/api/admin/sync-grant-sources', { publisherCodes: ['bdns'] }, (d) => {
            const result = d.result as {
              totals?: { publishers: number; discovered: number; published: number; rejected: number }
              runs?: Array<{ publisherName: string; status: string }>
            }
            return [
              `✓ ${result?.totals?.publishers ?? '?'} publisher(s) orquestados`,
              `${result?.totals?.discovered ?? '?'} convocatorias descubiertas`,
              `${result?.totals?.published ?? '?'} publicadas · ${result?.totals?.rejected ?? '?'} rechazadas`,
              '',
              ...(result?.runs ?? []).slice(0, 4).map(run => `${run.publisherName}: ${run.status}`),
            ].join('\n')
          })}
        />

        <OpCard
          icon={RefreshCw}
          title="Sincronizar BDNS"
          description="Descarga las últimas convocatorias del BDNS y actualiza la base de datos. Incluye parsing de tipos de beneficiarios para filtrado preciso."
          buttonLabel="Lanzar sync"
          confirmMessage="Se lanzará una sincronización completa del BDNS. ¿Quieres continuar?"
          lastRun={lastByAction.sync_bdns}
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
          confirmMessage="Se recalculará el matching para todas las empresas. ¿Quieres continuar?"
          lastRun={lastByAction.run_matching_all}
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
          confirmMessage="Se ejecutará enriquecimiento con IA sobre convocatorias recientes. ¿Quieres continuar?"
          lastRun={lastByAction.enrich_grants}
          result={enrich}
          onRun={() => runOp(setEnrich, '/api/admin/enrich-grants', undefined, (d) => {
            const s = d.stats as Record<string, unknown>
            return `✓ ${s?.enriched ?? '?'} enriquecidas\n✗ ${s?.failed ?? '?'} fallidas\n${s?.durationMs ?? '?'} ms`
          })}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <AdminSectionCard title="Historial de operaciones" subtitle="Últimas ejecuciones registradas">
          <div style={{ display: 'grid', gap: 10 }}>
            {history.length > 0 ? history.map(item => (
              <div
                key={item.id}
                style={{
                  padding: '12px 14px',
                  borderRadius: 12,
                  background: 'var(--bg)',
                  border: '1px solid var(--line)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', marginBottom: 6 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg)' }}>
                    {item.target_label ?? item.action}
                  </div>
                  <AdminPill tone={item.status === 'error' ? 'danger' : item.status === 'success' ? 'good' : 'neutral'}>
                    {item.status}
                  </AdminPill>
                </div>
                <div style={{ fontSize: 12, color: 'var(--fg-4)' }}>{formatDate(item.created_at)}</div>
                {item.metadata && (
                  <div style={{ marginTop: 8, fontSize: 11.5, color: 'var(--fg-3)', lineHeight: 1.5 }}>
                    {Object.entries(item.metadata).slice(0, 3).map(([key, value]) => `${key}: ${String(value)}`).join(' · ')}
                  </div>
                )}
              </div>
            )) : (
              <div style={{ color: 'var(--fg-3)', fontSize: 13 }}>Todavía no hay ejecuciones registradas.</div>
            )}
          </div>
        </AdminSectionCard>
      </div>
    </div>
  )
}
