'use client'

import type { CSSProperties } from 'react'
import { useMemo, useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { AdminPill } from '@/components/admin/admin-ui'

interface UserRow {
  id: string
  email: string
  full_name: string | null
  role: string
  is_superadmin: boolean
  is_active: boolean
  created_at: string | null
  updated_at: string | null
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

export function UsuariosTable({ rows, canManageRoles }: { rows: UserRow[]; canManageRoles: boolean }) {
  const [activeState, setActiveState] = useState<Record<string, boolean>>(
    Object.fromEntries(rows.map(row => [row.id, row.is_active]))
  )
  const [roleState, setRoleState] = useState<Record<string, string>>(
    Object.fromEntries(rows.map(row => [row.id, row.role]))
  )
  const [loading, setLoading] = useState<Record<string, boolean>>({})
  const [query, setQuery] = useState('')
  const [planFilter, setPlanFilter] = useState('all')
  const [roleFilter, setRoleFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  async function patchUser(userId: string, payload: { is_active?: boolean; role?: string }) {
    setLoading(state => ({ ...state, [userId]: true }))
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      return res.ok
    } finally {
      setLoading(state => ({ ...state, [userId]: false }))
    }
  }

  async function toggleActive(userId: string) {
    const nextActive = !(activeState[userId] ?? false)
    const ok = await patchUser(userId, { is_active: nextActive })
    if (ok) {
      setActiveState(state => ({ ...state, [userId]: nextActive }))
    }
  }

  async function changeRole(userId: string, nextRole: string) {
    const previousRole = roleState[userId]
    setRoleState(state => ({ ...state, [userId]: nextRole }))
    const ok = await patchUser(userId, { role: nextRole })
    if (!ok) {
      setRoleState(state => ({ ...state, [userId]: previousRole }))
    }
  }

  const plans = [...new Set(rows.map(row => row.orgPlan).filter(Boolean))].sort()
  const roles = [...new Set(rows.map(row => row.role).filter(Boolean))].sort()

  const filteredRows = useMemo(() => {
    return rows.filter(row => {
      const isActive = activeState[row.id] ?? row.is_active
      const currentRole = roleState[row.id] ?? row.role
      const haystack = [row.full_name, row.email, row.orgName, currentRole].filter(Boolean).join(' ').toLowerCase()

      if (query && !haystack.includes(query.toLowerCase())) return false
      if (planFilter !== 'all' && row.orgPlan !== planFilter) return false
      if (roleFilter !== 'all' && currentRole !== roleFilter) return false
      if (statusFilter === 'active' && !isActive) return false
      if (statusFilter === 'inactive' && isActive) return false
      if (statusFilter === 'superadmin' && !row.is_superadmin) return false
      return true
    })
  }, [activeState, planFilter, query, roleFilter, roleState, rows, statusFilter])

  if (rows.length === 0) {
    return <div style={{ color: 'var(--fg-3)', fontSize: 13 }}>No hay usuarios registrados.</div>
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
          placeholder="Buscar por usuario, email, organización o rol"
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
        <select value={planFilter} onChange={event => setPlanFilter(event.target.value)} style={selectStyle}>
          <option value="all">Todos los planes</option>
          {plans.map(plan => <option key={plan} value={plan}>{plan}</option>)}
        </select>
        <select value={roleFilter} onChange={event => setRoleFilter(event.target.value)} style={selectStyle}>
          <option value="all">Todos los roles</option>
          {roles.map(role => <option key={role} value={role}>{role}</option>)}
        </select>
        <select value={statusFilter} onChange={event => setStatusFilter(event.target.value)} style={selectStyle}>
          <option value="all">Todos los estados</option>
          <option value="active">Activos</option>
          <option value="inactive">Inactivos</option>
          <option value="superadmin">Superadmin</option>
        </select>
        <div style={{ display: 'flex', alignItems: 'center', padding: '0 2px', color: 'var(--fg-4)', fontSize: 12.5 }}>
          {filteredRows.length} / {rows.length} usuarios
        </div>
      </div>

      <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid var(--line)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--bg)' }}>
          <thead>
            <tr style={{ background: 'var(--bg-2)' }}>
              <TH>Usuario</TH>
              <TH>Organización</TH>
              <TH>Plan</TH>
              <TH>Rol</TH>
              <TH>Actividad</TH>
              <TH>Estado</TH>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map(row => {
              const isActive = activeState[row.id] ?? row.is_active
              const isLoading = loading[row.id] ?? false
              const currentRole = roleState[row.id] ?? row.role

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
                    {row.is_superadmin ? (
                      <AdminPill tone="accent">superadmin</AdminPill>
                    ) : (
                      <select
                        value={currentRole}
                        onChange={event => changeRole(row.id, event.target.value)}
                        disabled={isLoading || !canManageRoles}
                        style={{
                          padding: '6px 8px',
                          borderRadius: 8,
                          border: '1px solid var(--line)',
                          background: 'var(--bg)',
                          color: 'var(--fg-2)',
                          fontSize: 12,
                          textTransform: 'capitalize',
                        }}
                      >
                        {roles.map(role => <option key={role} value={role}>{role}</option>)}
                      </select>
                    )}
                  </TD>
                  <TD>
                    <div style={{ fontSize: 12, color: 'var(--fg-2)' }}>{formatDate(row.updated_at)}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--fg-4)', marginTop: 3 }}>
                      Alta {formatDate(row.created_at)}
                    </div>
                  </TD>
                  <TD>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <button
                        onClick={() => toggleActive(row.id)}
                        disabled={isLoading || row.is_superadmin}
                        title={row.is_superadmin ? 'No se puede desactivar un superadmin' : isActive ? 'Desactivar' : 'Activar'}
                        style={{
                          padding: '5px 12px',
                          borderRadius: 99,
                          border: '1px solid',
                          borderColor: isActive ? 'var(--good)' : 'var(--line)',
                          background: isActive ? 'var(--good-soft)' : 'var(--bg-2)',
                          color: isActive ? 'var(--good)' : 'var(--fg-4)',
                          fontSize: 11.5,
                          fontWeight: 500,
                          cursor: row.is_superadmin ? 'default' : 'pointer',
                          opacity: isLoading ? 0.6 : 1,
                          transition: 'all .12s ease',
                        }}
                      >
                        {isLoading ? '...' : isActive ? 'Activo' : 'Inactivo'}
                      </button>
                      {row.is_superadmin && <AdminPill tone="accent">Protegido</AdminPill>}
                    </div>
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

const selectStyle: CSSProperties = {
  padding: '9px 12px',
  borderRadius: 9,
  border: '1px solid var(--line)',
  background: 'var(--bg)',
  color: 'var(--fg)',
  fontSize: 13,
}
