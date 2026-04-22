'use client'

import type { CSSProperties, ReactNode } from 'react'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'
import { AdminPill } from '@/components/admin/admin-ui'
import { formatDate } from '@/lib/utils'

interface PublisherSummary {
  publisher: {
    id: string
    code: string
    name: string
    level: 'estado' | 'ccaa' | 'local' | 'ue'
    territory: string | null
    discovery_url: string | null
    is_active: boolean
  }
  lastRun: {
    status: 'running' | 'success' | 'error' | 'partial' | 'skipped'
    finished_at: string | null
  } | null
  publishedRate: number | null
  errorRate: number | null
  totalRuns: number
  discoveredTotal: number
  publishedTotal: number
  isImplemented: boolean
}

const CORE_OFFICIAL_CODES = ['boe', 'ccaa-comunidad-de-madrid', 'ccaa-andalucia', 'ccaa-cataluna'] as const

function pillToneForRun(status: string | null | undefined) {
  if (status === 'success') return 'good' as const
  if (status === 'partial') return 'warn' as const
  if (status === 'error') return 'danger' as const
  if (status === 'running') return 'info' as const
  return 'neutral' as const
}

export function GrantPublisherManager({ initialPublishers }: { initialPublishers: PublisherSummary[] }) {
  const router = useRouter()
  const [overrides, setOverrides] = useState<Record<string, PublisherSummary>>({})
  const [busyCode, setBusyCode] = useState<string | null>(null)
  const [batchState, setBatchState] = useState<'idle' | 'running' | 'ok' | 'error'>('idle')
  const [batchMessage, setBatchMessage] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  const publishers = initialPublishers.map(item => overrides[item.publisher.code] ?? item)

  function updateRow(code: string, nextRow: PublisherSummary | null | undefined) {
    if (!nextRow) return
    setOverrides(current => ({ ...current, [code]: nextRow }))
  }

  async function togglePublisher(code: string, isActive: boolean) {
    setBusyCode(code)
    try {
      const response = await fetch(`/api/admin/grant-system/publishers/${code}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
      })
      const data = await response.json()
      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? 'No se pudo actualizar la fuente')
      }

      updateRow(code, data.summary as PublisherSummary | undefined)
      startTransition(() => router.refresh())
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'No se pudo actualizar la fuente')
    } finally {
      setBusyCode(current => (current === code ? null : current))
    }
  }

  async function syncPublisher(code: string) {
    setBusyCode(code)
    try {
      const response = await fetch(`/api/admin/grant-system/publishers/${code}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maxItems: 8 }),
      })
      const data = await response.json()
      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? 'No se pudo lanzar la sincronización')
      }

      updateRow(code, data.summary as PublisherSummary | undefined)
      startTransition(() => router.refresh())
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'No se pudo lanzar la sincronización')
    } finally {
      setBusyCode(current => (current === code ? null : current))
    }
  }

  async function syncCorePublishers() {
    setBatchState('running')
    setBatchMessage(null)
    try {
      const response = await fetch('/api/admin/sync-grant-sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publisherCodes: [...CORE_OFFICIAL_CODES],
          pageSize: 8,
          force: true,
        }),
      })
      const data = await response.json()
      if (!response.ok || !data.ok) {
        throw new Error(data.error ?? 'No se pudo lanzar la sincronización oficial')
      }

      const result = data.result as {
        totals?: { discovered: number; published: number; rejected: number }
        runs?: Array<{ publisherName: string; status: string }>
      }
      setBatchState('ok')
      setBatchMessage([
        `${result?.totals?.discovered ?? 0} descubiertas`,
        `${result?.totals?.published ?? 0} publicadas`,
        `${result?.totals?.rejected ?? 0} rechazadas`,
        '',
        ...(result?.runs ?? []).map(run => `${run.publisherName}: ${run.status}`).slice(0, 4),
      ].join('\n'))
      startTransition(() => router.refresh())
    } catch (error) {
      setBatchState('error')
      setBatchMessage(error instanceof Error ? error.message : 'No se pudo lanzar la sincronización oficial')
    }
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
      }}>
        <div style={{ fontSize: 12.5, color: 'var(--fg-3)', lineHeight: 1.5 }}>
          Desde aquí puedes pausar fuentes, relanzar una sync puntual y revisar cuáles ya tienen conector real para empresa/startup.
        </div>
        <button
          onClick={() => {
            if (!window.confirm('Se lanzará una sync de BOE, Comunidad de Madrid, Andalucía y Cataluña. ¿Quieres continuar?')) return
            void syncCorePublishers()
          }}
          disabled={batchState === 'running'}
          style={primaryButtonStyle(batchState === 'running')}
        >
          {batchState === 'running' && <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} />}
          {batchState === 'running' ? 'Sincronizando...' : 'Sync fuentes empresariales'}
        </button>
      </div>

      {batchMessage && (
        <pre style={{
          margin: 0,
          padding: '12px 14px',
          borderRadius: 12,
          border: `1px solid ${batchState === 'error' ? 'var(--danger)' : 'var(--line)'}`,
          background: batchState === 'error' ? 'color-mix(in oklch, var(--danger) 10%, transparent)' : 'var(--bg)',
          color: batchState === 'error' ? 'var(--danger)' : 'var(--fg-2)',
          fontSize: 11.5,
          lineHeight: 1.6,
          fontFamily: 'var(--font-geist-mono)',
          whiteSpace: 'pre-wrap',
        }}>{batchMessage}</pre>
      )}

      <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid var(--line)' }}>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--bg)' }}>
          <thead>
            <tr style={{ background: 'var(--bg-2)' }}>
              <TableHead>Fuente</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Adapter</TableHead>
              <TableHead>Última run</TableHead>
              <TableHead>Conversión</TableHead>
              <TableHead>Acciones</TableHead>
            </tr>
          </thead>
          <tbody>
            {publishers.map(item => {
              const isBusy = busyCode === item.publisher.code
              const isCore = CORE_OFFICIAL_CODES.includes(item.publisher.code as (typeof CORE_OFFICIAL_CODES)[number])

              return (
                <tr key={item.publisher.id}>
                  <TableCell>
                    <div style={{ display: 'grid', gap: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 500, color: 'var(--fg)' }}>{item.publisher.name}</span>
                        <AdminPill tone={isCore ? 'accent' : 'neutral'}>{item.publisher.level}</AdminPill>
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--fg-4)' }}>{item.publisher.code} · {item.publisher.territory ?? '—'}</div>
                      {item.publisher.discovery_url && (
                        <a
                          href={item.publisher.discovery_url}
                          target="_blank"
                          rel="noreferrer"
                          style={{ fontSize: 11.5, color: 'var(--accent-ink)', textDecoration: 'none' }}
                        >
                          Abrir discovery oficial
                        </a>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div style={{ display: 'grid', gap: 6 }}>
                      <AdminPill tone={item.publisher.is_active ? 'good' : 'neutral'}>
                        {item.publisher.is_active ? 'activa' : 'pausada'}
                      </AdminPill>
                      <span style={{ fontSize: 11.5, color: 'var(--fg-4)' }}>{item.totalRuns} run(s)</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div style={{ display: 'grid', gap: 6 }}>
                      <AdminPill tone={item.isImplemented ? 'info' : 'warn'}>
                        {item.isImplemented ? 'implementado' : 'pendiente'}
                      </AdminPill>
                      <span style={{ fontSize: 11.5, color: 'var(--fg-4)' }}>
                        {item.discoveredTotal} descubiertas · {item.publishedTotal} publicadas
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div style={{ display: 'grid', gap: 4 }}>
                      <AdminPill tone={pillToneForRun(item.lastRun?.status)}>{item.lastRun?.status ?? 'sin runs'}</AdminPill>
                      <span style={{ fontSize: 11.5, color: 'var(--fg-4)' }}>
                        {item.lastRun?.finished_at ? formatDate(item.lastRun.finished_at) : 'Aún no ejecutada'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div style={{ display: 'grid', gap: 4 }}>
                      <span style={{ fontSize: 12.5, color: 'var(--fg-2)' }}>{item.publishedRate !== null ? `${item.publishedRate}% published` : '—'}</span>
                      <span style={{ fontSize: 11.5, color: 'var(--fg-4)' }}>{item.errorRate !== null ? `${item.errorRate}% error` : 'Sin histórico'}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button
                        onClick={() => {
                          if (!window.confirm(`Se sincronizará ${item.publisher.name}. ¿Quieres continuar?`)) return
                          void syncPublisher(item.publisher.code)
                        }}
                        disabled={isBusy || !item.publisher.is_active || !item.isImplemented}
                        style={secondaryButtonStyle(isBusy || !item.publisher.is_active || !item.isImplemented)}
                      >
                        {isBusy ? 'Procesando...' : 'Sync ahora'}
                      </button>
                      <button
                        onClick={() => {
                          const nextState = !item.publisher.is_active
                          if (!window.confirm(`${nextState ? 'Activar' : 'Pausar'} ${item.publisher.name}?`)) return
                          void togglePublisher(item.publisher.code, nextState)
                        }}
                        disabled={isBusy}
                        style={secondaryButtonStyle(isBusy)}
                      >
                        {item.publisher.is_active ? 'Pausar' : 'Activar'}
                      </button>
                    </div>
                  </TableCell>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function TableHead({ children }: { children: ReactNode }) {
  return (
    <th style={{
      padding: '9px 12px',
      textAlign: 'left',
      fontSize: 11,
      color: 'var(--fg-4)',
      fontWeight: 500,
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
      borderBottom: '1px solid var(--line)',
      whiteSpace: 'nowrap',
    }}>{children}</th>
  )
}

function TableCell({ children }: { children: ReactNode }) {
  return (
    <td style={{
      padding: '10px 12px',
      fontSize: 13,
      color: 'var(--fg-2)',
      borderBottom: '1px solid var(--line)',
      verticalAlign: 'top',
    }}>{children}</td>
  )
}

function primaryButtonStyle(disabled: boolean) {
  return {
    padding: '8px 14px',
    borderRadius: 999,
    border: '1px solid var(--line)',
    background: disabled ? 'var(--bg-2)' : 'var(--fg)',
    color: disabled ? 'var(--fg-3)' : 'var(--bg)',
    fontSize: 12.5,
    fontWeight: 500,
    cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
  } satisfies CSSProperties
}

function secondaryButtonStyle(disabled: boolean) {
  return {
    padding: '7px 10px',
    borderRadius: 8,
    border: '1px solid var(--line)',
    background: disabled ? 'var(--bg-2)' : 'var(--bg)',
    color: disabled ? 'var(--fg-4)' : 'var(--fg)',
    fontSize: 12,
    fontWeight: 500,
    cursor: disabled ? 'not-allowed' : 'pointer',
  } satisfies CSSProperties
}
