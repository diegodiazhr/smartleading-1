'use client'

import { useState } from 'react'
import { ShieldCheck } from 'lucide-react'

interface UserRow {
  id: string
  email: string
  full_name: string | null
  role: string
  is_superadmin: boolean
  is_active: boolean
  created_at: string | null
  orgName: string
  orgPlan: string
}

const TH = ({ children }: { children: React.ReactNode }) => (
  <th style={{
    padding: '8px 12px', textAlign: 'left',
    fontSize: 11, color: 'var(--fg-4)', fontWeight: 500,
    textTransform: 'uppercase', letterSpacing: '0.06em',
    borderBottom: '1px solid var(--line)', whiteSpace: 'nowrap',
  }}>{children}</th>
)

const TD = ({ children }: { children: React.ReactNode }) => (
  <td style={{
    padding: '10px 12px', fontSize: 13, color: 'var(--fg-2)',
    borderBottom: '1px solid var(--line)', verticalAlign: 'middle',
  }}>{children}</td>
)

const PLAN_COLORS: Record<string, string> = {
  free: 'var(--fg-4)',
  starter: 'var(--info)',
  growth: 'var(--accent-ink)',
  scale: 'var(--good)',
  enterprise: 'var(--warn)',
}

export function UsuariosTable({ rows }: { rows: UserRow[] }) {
  const [activeState, setActiveState] = useState<Record<string, boolean>>(
    Object.fromEntries(rows.map(r => [r.id, r.is_active]))
  )
  const [loading, setLoading] = useState<Record<string, boolean>>({})

  async function toggleActive(userId: string) {
    const newVal = !activeState[userId]
    setLoading(s => ({ ...s, [userId]: true }))
    try {
      await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: newVal }),
      })
      setActiveState(s => ({ ...s, [userId]: newVal }))
    } finally {
      setLoading(s => ({ ...s, [userId]: false }))
    }
  }

  if (rows.length === 0) {
    return <div style={{ color: 'var(--fg-3)', fontSize: 13 }}>No hay usuarios registrados.</div>
  }

  return (
    <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid var(--line)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--bg)' }}>
        <thead>
          <tr style={{ background: 'var(--bg-2)' }}>
            <TH>Usuario</TH>
            <TH>Organización</TH>
            <TH>Plan</TH>
            <TH>Rol</TH>
            <TH>Registro</TH>
            <TH>Estado</TH>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => {
            const isActive = activeState[row.id] ?? true
            const isLoading = loading[row.id] ?? false

            return (
              <tr key={row.id}>
                <TD>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontWeight: 500, color: 'var(--fg)' }}>
                        {row.full_name || row.email.split('@')[0]}
                      </span>
                      {row.is_superadmin && (
                        <ShieldCheck size={13} style={{ color: 'var(--accent-ink)', flexShrink: 0 }} />
                      )}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--fg-4)', marginTop: 2 }}>{row.email}</div>
                  </div>
                </TD>
                <TD>{row.orgName}</TD>
                <TD>
                  <span style={{
                    fontSize: 11, padding: '2px 8px', borderRadius: 99,
                    background: 'var(--bg-3)',
                    color: PLAN_COLORS[row.orgPlan] ?? 'var(--fg-3)',
                    fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em',
                  }}>{row.orgPlan}</span>
                </TD>
                <TD>
                  <span style={{ fontSize: 12, color: 'var(--fg-3)', textTransform: 'capitalize' }}>{row.role}</span>
                </TD>
                <TD>
                  <span style={{ fontSize: 12, color: 'var(--fg-4)', fontFamily: 'var(--font-geist-mono)' }}>
                    {row.created_at ? new Date(row.created_at).toLocaleDateString('es-ES') : '—'}
                  </span>
                </TD>
                <TD>
                  <button
                    onClick={() => toggleActive(row.id)}
                    disabled={isLoading || row.is_superadmin}
                    title={row.is_superadmin ? 'No se puede desactivar un superadmin' : isActive ? 'Desactivar' : 'Activar'}
                    style={{
                      padding: '5px 12px', borderRadius: 99,
                      border: '1px solid',
                      borderColor: isActive ? 'var(--good)' : 'var(--line)',
                      background: isActive ? 'var(--good-soft)' : 'var(--bg-2)',
                      color: isActive ? 'var(--good)' : 'var(--fg-4)',
                      fontSize: 11.5, fontWeight: 500, cursor: row.is_superadmin ? 'default' : 'pointer',
                      opacity: isLoading ? 0.6 : 1,
                      transition: 'all .12s ease',
                    }}
                  >
                    {isLoading ? '...' : isActive ? 'Activo' : 'Inactivo'}
                  </button>
                </TD>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
