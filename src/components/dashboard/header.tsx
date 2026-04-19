'use client'

import Link from 'next/link'
import { HelpCircle, Bell, Plus } from 'lucide-react'

interface HeaderProps {
  section?: string
  title: string
  subtitle?: string
}

export default function Header({ section = 'Panel', title }: HeaderProps) {
  return (
    <div style={{
      background: 'var(--bg)',
      borderBottom: '1px solid var(--line)',
      padding: '0 28px',
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      height: 53,
      position: 'sticky',
      top: 0,
      zIndex: 10,
      flexShrink: 0,
    }}>
      {/* Breadcrumb */}
      <div style={{ fontSize: 13, color: 'var(--fg-3)' }}>
        {section} · <b style={{ color: 'var(--fg)', fontWeight: 500 }}>{title}</b>
      </div>

      <div style={{ flex: 1 }} />

      {/* Search */}
      <div style={{
        background: 'var(--bg-2)',
        border: '1px solid var(--line)',
        borderRadius: 8,
        padding: '7px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        minWidth: 320,
        fontSize: 13,
        color: 'var(--fg-3)',
        cursor: 'text',
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
          <circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>
        </svg>
        <span style={{ flex: 1 }}>Buscar ayudas, expedientes, organismos…</span>
        <span style={{
          background: 'var(--bg)',
          border: '1px solid var(--line)',
          borderRadius: 4,
          padding: '1px 5px',
          fontSize: 10,
          color: 'var(--fg-3)',
        }}>⌘ K</span>
      </div>

      {/* Help */}
      <button style={{
        width: 34, height: 34, borderRadius: 8,
        border: '1px solid var(--line)',
        background: 'var(--bg)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--fg-2)', cursor: 'pointer',
      }} title="Ayuda">
        <HelpCircle size={16} strokeWidth={1.75} />
      </button>

      {/* Notifications */}
      <button style={{
        width: 34, height: 34, borderRadius: 8,
        border: '1px solid var(--line)',
        background: 'var(--bg)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--fg-2)', cursor: 'pointer',
        position: 'relative',
      }} title="Notificaciones">
        <Bell size={16} strokeWidth={1.75} />
        <span style={{
          position: 'absolute', top: 7, right: 7,
          width: 7, height: 7, borderRadius: '50%',
          background: 'var(--accent)',
          border: '2px solid var(--bg)',
        }} />
      </button>

      {/* CTA */}
      <Link href="/dashboard/expedientes" style={{
        background: 'var(--accent)',
        color: 'var(--accent-ink)',
        border: '1px solid var(--accent)',
        padding: '7px 14px',
        borderRadius: 8,
        fontSize: 13,
        fontWeight: 500,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        textDecoration: 'none',
        whiteSpace: 'nowrap',
      }}>
        <Plus size={14} strokeWidth={2} />
        Nuevo expediente
      </Link>
    </div>
  )
}
