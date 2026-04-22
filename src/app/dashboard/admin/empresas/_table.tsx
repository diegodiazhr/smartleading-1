'use client'

import { Fragment, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { AdminPill } from '@/components/admin/admin-ui'

interface CompanyRow {
  id: string
  name: string
  cif: string
  cnae_primary: string | null
  region: string | null
  municipality: string | null
  website: string | null
  employees_count: number | null
  revenue_annual: number | null
  is_startup: boolean | null
  has_rd: boolean | null
  doc_score: number | null
  created_at: string | null
  updated_at: string | null
  matchTotal: number
  matchHigh: number
  lastCalculated: string | null
}

const TH = ({ children }: { children: React.ReactNode }) => (
  <th style={{
    padding: '8px 12px', textAlign: 'left',
    fontSize: 11, color: 'var(--fg-4)', fontWeight: 500,
    textTransform: 'uppercase', letterSpacing: '0.06em',
    borderBottom: '1px solid var(--line)', whiteSpace: 'nowrap',
  }}>{children}</th>
)

const TD = ({ children, mono }: { children: React.ReactNode; mono?: boolean }) => (
  <td style={{
    padding: '10px 12px', fontSize: 13, color: 'var(--fg-2)',
    borderBottom: '1px solid var(--line)',
    fontFamily: mono ? 'var(--font-geist-mono)' : undefined,
    verticalAlign: 'middle',
  }}>{children}</td>
)

function fmt(n: number | null) {
  if (!n) return '—'
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
}

function daysSince(date: string | null) {
  if (!date) return null
  return Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24))
}

function profileHealth(row: CompanyRow) {
  const checks = [
    Boolean(row.cnae_primary),
    Boolean(row.region),
    Boolean(row.employees_count),
    Boolean(row.revenue_annual),
    Boolean(row.website),
  ]
  const score = Math.round((checks.filter(Boolean).length / checks.length) * 100)
  if (score >= 80) return { label: 'Lista', tone: 'good' as const }
  if (score >= 50) return { label: 'Parcial', tone: 'warn' as const }
  return { label: 'Incompleta', tone: 'danger' as const }
}

export function EmpresasTable({ rows }: { rows: CompanyRow[] }) {
  const [runState, setRunState] = useState<Record<string, 'idle' | 'running' | 'ok' | 'error'>>({})
  const [query, setQuery] = useState('')
  const [region, setRegion] = useState('all')
  const [segment, setSegment] = useState('all')
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  async function runMatching(companyId: string) {
    setRunState(s => ({ ...s, [companyId]: 'running' }))
    try {
      const res = await fetch(`/api/admin/matching/${companyId}`, { method: 'POST' })
      const data = await res.json()
      setRunState(s => ({ ...s, [companyId]: data.ok ? 'ok' : 'error' }))
    } catch {
      setRunState(s => ({ ...s, [companyId]: 'error' }))
    }
  }

  const regions = [...new Set(rows.map(row => row.region).filter((region): region is string => Boolean(region)))].sort()
  const filteredRows = rows.filter(row => {
    const haystack = [
      row.name,
      row.cif,
      row.cnae_primary,
      row.region,
      row.municipality,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()

    const stale = row.lastCalculated ? (daysSince(row.lastCalculated) ?? 0) > 7 : false

    if (query && !haystack.includes(query.toLowerCase())) return false
    if (region !== 'all' && row.region !== region) return false
    if (segment === 'startup' && !row.is_startup) return false
    if (segment === 'rd' && !row.has_rd) return false
    if (segment === 'no_matches' && row.matchTotal > 0) return false
    if (segment === 'high_fit' && row.matchHigh === 0) return false
    if (segment === 'stale' && !stale) return false

    return true
  })

  if (rows.length === 0) {
    return <div style={{ color: 'var(--fg-3)', fontSize: 13 }}>No hay empresas registradas.</div>
  }

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{
        display: 'flex',
        gap: 10,
        flexWrap: 'wrap',
        padding: '14px 16px',
        background: 'var(--bg-2)',
        border: '1px solid var(--line)',
        borderRadius: 12,
      }}>
        <input
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder="Buscar por nombre, CIF, región o CNAE"
          style={{
            minWidth: 240,
            flex: 1,
            padding: '9px 12px',
            borderRadius: 9,
            border: '1px solid var(--line)',
            background: 'var(--bg)',
            color: 'var(--fg)',
            fontSize: 13,
          }}
        />
        <select
          value={region}
          onChange={event => setRegion(event.target.value)}
          style={{
            padding: '9px 12px',
            borderRadius: 9,
            border: '1px solid var(--line)',
            background: 'var(--bg)',
            color: 'var(--fg)',
            fontSize: 13,
          }}
        >
          <option value="all">Todas las regiones</option>
          {regions.map(option => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
        <select
          value={segment}
          onChange={event => setSegment(event.target.value)}
          style={{
            padding: '9px 12px',
            borderRadius: 9,
            border: '1px solid var(--line)',
            background: 'var(--bg)',
            color: 'var(--fg)',
            fontSize: 13,
          }}
        >
          <option value="all">Todos los segmentos</option>
          <option value="startup">Solo startups</option>
          <option value="rd">Solo I+D</option>
          <option value="high_fit">Con alta afinidad</option>
          <option value="no_matches">Sin matches</option>
          <option value="stale">Matching desactualizado</option>
        </select>
        <div style={{ display: 'flex', alignItems: 'center', padding: '0 2px', color: 'var(--fg-4)', fontSize: 12.5 }}>
          {filteredRows.length} / {rows.length} empresas
        </div>
      </div>

      <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid var(--line)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--bg)' }}>
          <thead>
            <tr style={{ background: 'var(--bg-2)' }}>
              <TH>Empresa</TH>
              <TH>Ubicación</TH>
              <TH>Negocio</TH>
              <TH>Perfil</TH>
              <TH>Matches</TH>
              <TH>Último matching</TH>
              <TH>Acciones</TH>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map(row => {
              const state = runState[row.id] ?? 'idle'
              const health = profileHealth(row)
              const staleDays = daysSince(row.lastCalculated)
              return (
                <Fragment key={row.id}>
                <tr key={row.id} style={{ transition: 'background .1s' }}>
                  <TD>
                    <div>
                      <div style={{ fontWeight: 500, color: 'var(--fg)' }}>{row.name}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--fg-4)', marginTop: 3 }}>{row.cif}</div>
                    </div>
                  </TD>
                  <TD>
                    <div>{row.region ?? '—'}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--fg-4)', marginTop: 3 }}>{row.municipality ?? 'Sin municipio'}</div>
                  </TD>
                  <TD>
                    <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 12 }}>{row.cnae_primary ?? '—'}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--fg-4)', marginTop: 3 }}>
                      {row.employees_count ?? '—'} empleados · {fmt(row.revenue_annual)}
                    </div>
                  </TD>
                  <TD>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                      <AdminPill tone={health.tone}>{health.label}</AdminPill>
                      {row.is_startup && <AdminPill tone="accent">Startup</AdminPill>}
                      {row.has_rd && <AdminPill tone="info">I+D</AdminPill>}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--fg-4)' }}>
                      Doc score {row.doc_score ?? 0}
                    </div>
                  </TD>
                  <TD>
                    <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 12 }}>
                      <span style={{ color: 'var(--good)', fontWeight: 600 }}>{row.matchTotal}</span>
                      {row.matchHigh > 0 && (
                        <span style={{ color: 'var(--fg-4)', marginLeft: 4 }}>/ {row.matchHigh} ★</span>
                      )}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--fg-4)', marginTop: 3 }}>
                      {row.matchTotal === 0 ? 'Pendiente' : row.matchHigh > 0 ? 'Con tracción' : 'Afinidad media'}
                    </div>
                  </TD>
                  <TD>
                    <div style={{ fontSize: 12, color: 'var(--fg-2)' }}>
                      {row.lastCalculated ? formatDate(row.lastCalculated) : 'Nunca'}
                    </div>
                    <div style={{ fontSize: 11.5, color: staleDays !== null && staleDays > 7 ? 'var(--danger)' : 'var(--fg-4)', marginTop: 3 }}>
                      {staleDays === null ? 'Sin cálculo' : `${staleDays} días`}
                    </div>
                  </TD>
                  <TD>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button
                        onClick={() => runMatching(row.id)}
                        disabled={state === 'running'}
                        title="Re-calcular matching"
                        style={{
                          display: 'flex', alignItems: 'center', gap: 5,
                          padding: '5px 10px', borderRadius: 7,
                          border: '1px solid var(--line)',
                          background: state === 'ok' ? 'var(--good-soft)' : state === 'error' ? 'color-mix(in oklch, var(--danger) 10%, transparent)' : 'var(--bg-2)',
                          color: state === 'ok' ? 'var(--good)' : state === 'error' ? 'var(--danger)' : 'var(--fg-2)',
                          fontSize: 12, cursor: state === 'running' ? 'not-allowed' : 'pointer',
                        }}
                      >
                        <RefreshCw size={11} style={{ animation: state === 'running' ? 'spin 1s linear infinite' : undefined }} />
                        {state === 'ok' ? 'Hecho' : state === 'error' ? 'Error' : 'Matching'}
                      </button>
                      <button
                        onClick={() => setExpanded(s => ({ ...s, [row.id]: !s[row.id] }))}
                        style={{
                          padding: '5px 10px',
                          borderRadius: 7,
                          border: '1px solid var(--line)',
                          background: 'var(--bg)',
                          color: 'var(--fg-2)',
                          fontSize: 12,
                          cursor: 'pointer',
                        }}
                      >
                        {expanded[row.id] ? 'Ocultar' : 'Detalle'}
                      </button>
                    </div>
                  </TD>
                </tr>
                {expanded[row.id] && (
                  <tr>
                    <td colSpan={7} style={{ padding: '0 12px 14px', borderBottom: '1px solid var(--line)' }}>
                      <div style={{
                        marginTop: 10,
                        padding: '14px 16px',
                        borderRadius: 10,
                        background: 'var(--bg-2)',
                        border: '1px solid var(--line)',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                        gap: 12,
                      }}>
                        <div>
                          <div style={{ fontSize: 11, color: 'var(--fg-4)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Web</div>
                          <div style={{ fontSize: 12.5, color: 'var(--fg-2)' }}>{row.website ?? 'No informada'}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 11, color: 'var(--fg-4)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Alta en sistema</div>
                          <div style={{ fontSize: 12.5, color: 'var(--fg-2)' }}>{formatDate(row.created_at)}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 11, color: 'var(--fg-4)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Última actualización</div>
                          <div style={{ fontSize: 12.5, color: 'var(--fg-2)' }}>{formatDate(row.updated_at)}</div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  )
}
