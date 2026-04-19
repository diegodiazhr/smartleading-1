'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const tabs = [
  { href: '/dashboard/admin', label: 'Resumen', exact: true },
  { href: '/dashboard/admin/operaciones', label: 'Operaciones', exact: false },
  { href: '/dashboard/admin/empresas', label: 'Empresas', exact: false },
  { href: '/dashboard/admin/usuarios', label: 'Usuarios', exact: false },
]

export function AdminNav() {
  const pathname = usePathname()
  return (
    <div style={{ display: 'flex', gap: 4, marginBottom: 24, flexWrap: 'wrap' }}>
      {tabs.map(({ href, label, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href)
        return (
          <Link key={href} href={href} style={{
            padding: '6px 16px',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: active ? 500 : 400,
            color: active ? 'var(--accent-ink)' : 'var(--fg-2)',
            background: active ? 'var(--accent-soft)' : 'var(--bg-2)',
            border: `1px solid ${active ? 'var(--accent-soft-2)' : 'var(--line)'}`,
            textDecoration: 'none',
            transition: 'all .12s ease',
          }}>{label}</Link>
        )
      })}
    </div>
  )
}
