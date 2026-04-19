'use client'

import { useState } from 'react'
import { RefreshCw } from 'lucide-react'

interface CompanyRow {
  id: string
  name: string
  cif: string
  cnae_primary: string | null
  region: string | null
  employees_count: number | null
  revenue_annual: number | null
  is_startup: boolean | null
  has_rd: boolean | null
  created_at: string | null
  matchTotal: number
  matchHigh: number
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

export function EmpresasTable({ rows }: { rows: CompanyRow[] }) {
  const [runState, setRunState] = useState<Record<string, 'idle' | 'running' | 'ok' | 'error'>>({})

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

  if (rows.length === 0) {
    return <div style={{ color: 'var(--fg-3)', fontSize: 13 }}>No hay empresas registradas.</div>
  }

  return (
    <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid var(--line)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--bg)' }}>
        <thead>
          <tr style={{ background: 'var(--bg-2)' }}>
            <TH>Empresa</TH>
            <TH>CIF</TH>
            <TH>CNAE</TH>
            <TH>Región</TH>
            <TH>Empleados</TH>
            <TH>Facturación</TH>
            <TH>Tipo</TH>
            <TH>Matches</TH>
            <TH>Acciones</TH>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => {
            const state = runState[row.id] ?? 'idle'
            return (
              <tr key={row.id} style={{ transition: 'background .1s' }}>
                <TD>
                  <span style={{ fontWeight: 500, color: 'var(--fg)' }}>{row.name}</span>
                </TD>
                <TD mono>{row.cif}</TD>
                <TD mono>{row.cnae_primary ?? '—'}</TD>
                <TD>{row.region ?? '—'}</TD>
                <TD mono>{row.employees_count ?? '—'}</TD>
                <TD mono>{fmt(row.revenue_annual)}</TD>
                <TD>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {row.is_startup && <span style={{
                      fontSize: 10, padding: '2px 7px', borderRadius: 99,
                      background: 'var(--accent-soft)', color: 'var(--accent-ink)',
                      fontWeight: 500,
                    }}>Startup</span>}
                    {row.has_rd && <span style={{
                      fontSize: 10, padding: '2px 7px', borderRadius: 99,
                      background: 'var(--info-soft)', color: 'var(--info)',
                      fontWeight: 500,
                    }}>I+D</span>}
                    {!row.is_startup && !row.has_rd && <span style={{ color: 'var(--fg-4)', fontSize: 12 }}>—</span>}
                  </div>
                </TD>
                <TD>
                  <div style={{ fontFamily: 'var(--font-geist-mono)', fontSize: 12 }}>
                    <span style={{ color: 'var(--good)', fontWeight: 600 }}>{row.matchTotal}</span>
                    {row.matchHigh > 0 && (
                      <span style={{ color: 'var(--fg-4)', marginLeft: 4 }}>/ {row.matchHigh} ★</span>
                    )}
                  </div>
                </TD>
                <TD>
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
                </TD>
              </tr>
            )
          })}
        </tbody>
      </table>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
