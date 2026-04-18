'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Landmark,
  LayoutDashboard,
  Search,
  FolderOpen,
  Receipt,
  Bell,
  Settings,
  Building2,
  LogOut,
  ChevronLeft,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/subvenciones', label: 'Subvenciones', icon: Search },
  { href: '/dashboard/expedientes', label: 'Expedientes', icon: FolderOpen },
  { href: '/dashboard/justificacion', label: 'Justificación', icon: Receipt },
  { href: '/dashboard/alertas', label: 'Alertas', icon: Bell },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [collapsed, setCollapsed] = useState(false)

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside
      className={cn(
        'flex flex-col h-full bg-white border-r border-gray-200 transition-all duration-200',
        collapsed ? 'w-16' : 'w-56'
      )}
    >
      {/* Logo */}
      <div className={cn('flex items-center gap-2.5 px-4 h-14 border-b border-gray-100', collapsed && 'justify-center px-0')}>
        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shrink-0">
          <Landmark className="w-4 h-4 text-white" />
        </div>
        {!collapsed && <span className="font-bold text-gray-900">Grantix</span>}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                active
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
                collapsed && 'justify-center px-0'
              )}
              title={collapsed ? label : undefined}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {!collapsed && <span>{label}</span>}
            </Link>
          )
        })}
      </nav>

      {/* Bottom */}
      <div className="px-2 pb-4 space-y-0.5 border-t border-gray-100 pt-3">
        <Link
          href="/dashboard/empresa"
          className={cn(
            'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900',
            collapsed && 'justify-center px-0'
          )}
          title={collapsed ? 'Mi Empresa' : undefined}
        >
          <Building2 className="w-4 h-4 shrink-0" />
          {!collapsed && <span>Mi Empresa</span>}
        </Link>
        <Link
          href="/dashboard/configuracion"
          className={cn(
            'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900',
            collapsed && 'justify-center px-0'
          )}
          title={collapsed ? 'Configuración' : undefined}
        >
          <Settings className="w-4 h-4 shrink-0" />
          {!collapsed && <span>Configuración</span>}
        </Link>
        <button
          onClick={handleLogout}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors',
            collapsed && 'justify-center px-0'
          )}
          title={collapsed ? 'Salir' : undefined}
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {!collapsed && <span>Salir</span>}
        </button>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors',
            collapsed && 'justify-center px-0'
          )}
        >
          <ChevronLeft className={cn('w-4 h-4 shrink-0 transition-transform', collapsed && 'rotate-180')} />
          {!collapsed && <span>Contraer</span>}
        </button>
      </div>
    </aside>
  )
}
