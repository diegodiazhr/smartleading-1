'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  Search,
  FolderOpen,
  Receipt,
  Bell,
  Settings,
  Building2,
  LogOut,
  ShieldCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

const navMain = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/subvenciones', label: 'Subvenciones', icon: Search, count: null as number | null },
  { href: '/dashboard/expedientes', label: 'Expedientes', icon: FolderOpen, count: null as number | null },
  { href: '/dashboard/justificacion', label: 'Justificación', icon: Receipt },
  { href: '/dashboard/alertas', label: 'Alertas', icon: Bell },
]

interface SidebarProps {
  companyName?: string
  companyCif?: string
  matchesCount?: number
  activeAppsCount?: number
  isSuperAdmin?: boolean
}

export default function Sidebar({ companyName, companyCif, matchesCount, activeAppsCount, isSuperAdmin }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const initials = companyName
    ? companyName.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
    : 'SL'

  return (
    <aside style={{
      width: 232,
      flexShrink: 0,
      borderRight: '1px solid var(--line)',
      background: 'var(--bg)',
      display: 'flex',
      flexDirection: 'column',
      padding: '20px 14px',
      position: 'sticky',
      top: 0,
      height: '100vh',
      overflowY: 'auto',
    }}>
      {/* Wordmark */}
      <Link href="/dashboard" style={{
        display: 'flex',
        alignItems: 'baseline',
        padding: '4px 8px 16px',
        fontSize: 18,
        fontWeight: 600,
        letterSpacing: '-0.02em',
        textDecoration: 'none',
        color: 'var(--fg)',
      }}>
        <span>Smart</span>
        <span style={{ color: 'var(--accent)' }}>Leading</span>
        <span style={{
          width: 4, height: 4, borderRadius: '50%',
          background: 'var(--accent)', marginLeft: 3,
          transform: 'translateY(-3px)', display: 'inline-block',
        }} />
      </Link>

      {/* Main nav */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {navMain.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
          const count = label === 'Subvenciones' ? matchesCount : label === 'Expedientes' ? activeAppsCount : undefined
          return (
            <Link key={href} href={href} className={cn('sl-nav-item', active && 'sl-nav-item--active')}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 10px', borderRadius: 8,
                color: active ? 'var(--accent-ink)' : 'var(--fg-2)',
                background: active ? 'var(--accent-soft)' : 'transparent',
                border: `1px solid ${active ? 'var(--accent-soft-2)' : 'transparent'}`,
                fontWeight: active ? 500 : 400,
                fontSize: 13.5,
                textDecoration: 'none',
                transition: 'all .12s ease',
              }}
            >
              <Icon size={16} strokeWidth={1.75} style={{ flexShrink: 0 }} />
              <span style={{ flex: 1 }}>{label}</span>
              {count != null && (
                <span style={{
                  marginLeft: 'auto', fontSize: 11,
                  color: 'var(--fg-4)', fontFamily: 'var(--font-geist-mono), monospace',
                }}>{count}</span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Admin section */}
      {isSuperAdmin && (
        <div style={{ marginTop: 8 }}>
          <div style={{
            fontSize: 10, color: 'var(--fg-4)',
            textTransform: 'uppercase', letterSpacing: '0.08em',
            padding: '14px 10px 6px',
          }}>Admin</div>
          <Link href="/admin" style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 10px', borderRadius: 8,
            color: pathname.startsWith('/admin') ? 'var(--accent-ink)' : 'var(--fg-2)',
            background: pathname.startsWith('/admin') ? 'var(--accent-soft)' : 'transparent',
            border: `1px solid ${pathname.startsWith('/admin') ? 'var(--accent-soft-2)' : 'transparent'}`,
            fontWeight: pathname.startsWith('/admin') ? 500 : 400,
            fontSize: 13.5, textDecoration: 'none',
          }}>
            <ShieldCheck size={16} strokeWidth={1.75} />
            Panel Admin
          </Link>
        </div>
      )}

      {/* Account section */}
      <div style={{ marginTop: 8 }}>
        <div style={{
          fontSize: 10, color: 'var(--fg-4)',
          textTransform: 'uppercase', letterSpacing: '0.08em',
          padding: '14px 10px 6px',
        }}>Cuenta</div>
        <Link href="/dashboard/empresa" style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '8px 10px', borderRadius: 8,
          color: 'var(--fg-2)', border: '1px solid transparent',
          fontSize: 13.5, textDecoration: 'none',
        }}>
          <Building2 size={16} strokeWidth={1.75} />
          Mi Empresa
        </Link>
        <Link href="/dashboard/configuracion" style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '8px 10px', borderRadius: 8,
          color: 'var(--fg-2)', border: '1px solid transparent',
          fontSize: 13.5, textDecoration: 'none',
        }}>
          <Settings size={16} strokeWidth={1.75} />
          Configuración
        </Link>
        <button onClick={handleLogout} style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
          padding: '8px 10px', borderRadius: 8,
          color: 'var(--fg-2)', background: 'none', border: '1px solid transparent',
          fontSize: 13.5, cursor: 'pointer', textAlign: 'left',
        }}>
          <LogOut size={16} strokeWidth={1.75} />
          Salir
        </button>
      </div>

      <div style={{ flex: 1 }} />

      {/* Company card */}
      <div style={{
        padding: 12, background: 'var(--bg-2)',
        border: '1px solid var(--line)', borderRadius: 10,
        marginTop: 8, display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: 'var(--accent-soft-2)', color: 'var(--accent-ink)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 600, fontSize: 13, flexShrink: 0,
        }}>{initials}</div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{
            fontSize: 13, fontWeight: 500, lineHeight: 1.2,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            color: 'var(--fg)',
          }}>{companyName || 'Mi Empresa'}</div>
          {companyCif && (
            <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 2 }}>{companyCif}</div>
          )}
        </div>
      </div>
    </aside>
  )
}
