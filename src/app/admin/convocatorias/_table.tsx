'use client'

import type { CSSProperties } from 'react'
import { useMemo, useState } from 'react'
import { formatDate } from '@/lib/utils'
import { AdminPill } from '@/components/admin/admin-ui'

interface GrantRow {
  id: string
  title: string
  organismo: string | null
  status: string
  source: string
  scope: string
  deadline: string | null
  summary: string | null
  source_url: string | null
  updated_at: string
  matchTotal: number
  callCount: number
  sourceRecordCount: number
}

const TH = ({ children }: { children: React.ReactNode }) => (
  <th style={{
    padding: '8px 12px',
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

const TD = ({ children }: { children: React.ReactNode }) => (
  <td style={{
    padding: '10px 12px',
    fontSize: 13,
    color: 'var(--fg-2)',
    borderBottom: '1px solid var(--line)',
    verticalAlign: 'middle',
  }}>{children}</td>
)

function quality(row: GrantRow) {
  const score = [
    Boolean(row.summary && row.summary.trim().length > 0),
    Boolean(row.source_url),
    row.callCount > 0,
    row.sourceRecordCount > 0,
  ].filter(Boolean).length

  if (score >= 4) return { label: 'Lista', tone: 'good' as const }
  if (score >= 2) return { label: 'Parcial', tone: 'warn' as const }
  return { label: 'Incompleta', tone: 'danger' as const }
}

export function ConvocatoriasTable({ rows }: { rows: GrantRow[] }) {
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [qualityFilter, setQualityFilter] = useState('all')

  const filteredRows = useMemo(() => {
    return rows.filter(row => {
      const q = query.trim().toLowerCase()
      const itemQuality = quality(row)
      const haystack = [row.title, row.organismo, row.source, row.scope].filter(Boolean).join(' ').toLowerCase()

      if (q && !haystack.includes(q)) return false
      if (statusFilter !== 'all' && row.status !== statusFilter) return false
      if (qualityFilter === 'missing_summary' && row.summary) return false
      if (qualityFilter === 'missing_source' && row.source_url) return false
      if (qualityFilter === 'ready' && itemQuality.label !== 'Lista') return false
      if (qualityFilter === 'partial' && itemQuality.label !== 'Parcial') return false
      return true
    })
  }, [qualityFilter, query, rows, statusFilter])

  const statuses = [...new Set(rows.map(row => row.status))].sort()

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
          placeholder="Buscar por título, organismo, fuente o ámbito"
          style={inputStyle}
        />
        <select value={statusFilter} onChange={event => setStatusFilter(event.target.value)} style={selectStyle}>
          <option value="all">Todos los estados</option>
          {statuses.map(status => <option key={status} value={status}>{status}</option>)}
        </select>
        <select value={qualityFilter} onChange={event => setQualityFilter(event.target.value)} style={selectStyle}>
          <option value="all">Toda la calidad</option>
          <option value="ready">Lista</option>
          <option value="partial">Parcial</option>
          <option value="missing_summary">Sin resumen</option>
          <option value="missing_source">Sin fuente</option>
        </select>
        <div style={{ display: 'flex', alignItems: 'center', color: 'var(--fg-4)', fontSize: 12.5 }}>
          {filteredRows.length} / {rows.length} convocatorias
        </div>
      </div>

      <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid var(--line)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--bg)' }}>
          <thead>
            <tr style={{ background: 'var(--bg-2)' }}>
              <TH>Convocatoria</TH>
              <TH>Estado</TH>
              <TH>Fuente</TH>
              <TH>Calidad</TH>
              <TH>Pipeline</TH>
              <TH>Tracción</TH>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map(row => {
              const itemQuality = quality(row)
              return (
                <tr key={row.id}>
                  <TD>
                    <div style={{ fontWeight: 500, color: 'var(--fg)' }}>{row.title}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--fg-4)', marginTop: 3 }}>
                      {[row.organismo, row.deadline ? `Cierra ${formatDate(row.deadline)}` : null].filter(Boolean).join(' · ') || 'Sin organismo'}
                    </div>
                  </TD>
                  <TD>
                    <AdminPill tone={row.status === 'abierta' ? 'good' : row.status === 'proxima' ? 'info' : 'neutral'}>
                      {row.status}
                    </AdminPill>
                  </TD>
                  <TD>
                    <div style={{ fontSize: 12.5, color: 'var(--fg-2)' }}>{row.source}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--fg-4)', marginTop: 3 }}>{row.scope}</div>
                  </TD>
                  <TD>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <AdminPill tone={itemQuality.tone}>{itemQuality.label}</AdminPill>
                      {!row.summary && <AdminPill tone="warn">Sin resumen</AdminPill>}
                      {!row.source_url && <AdminPill tone="danger">Sin fuente</AdminPill>}
                    </div>
                  </TD>
                  <TD>
                    <div style={{ fontSize: 12.5, color: 'var(--fg-2)' }}>{row.callCount} calls</div>
                    <div style={{ fontSize: 11.5, color: 'var(--fg-4)', marginTop: 3 }}>{row.sourceRecordCount} fuentes persistidas</div>
                  </TD>
                  <TD>
                    <div style={{ fontSize: 12.5, color: 'var(--fg-2)' }}>{row.matchTotal} matches</div>
                    <div style={{ fontSize: 11.5, color: 'var(--fg-4)', marginTop: 3 }}>Actualizada {formatDate(row.updated_at)}</div>
                  </TD>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const inputStyle: CSSProperties = {
  minWidth: 240,
  flex: 1,
  padding: '9px 12px',
  borderRadius: 9,
  border: '1px solid var(--line)',
  background: 'var(--bg)',
  color: 'var(--fg)',
  fontSize: 13,
}

const selectStyle: CSSProperties = {
  padding: '9px 12px',
  borderRadius: 9,
  border: '1px solid var(--line)',
  background: 'var(--bg)',
  color: 'var(--fg)',
  fontSize: 13,
}
