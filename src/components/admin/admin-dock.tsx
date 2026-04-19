'use client'

import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, RefreshCw, Building2, Users, ArrowLeft, LogOut } from 'lucide-react'
import { Dock } from '@/components/ui/dock-two'
import { createClient } from '@/lib/supabase/client'

export function AdminDock({ showBackToDashboard }: { showBackToDashboard: boolean }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const items = [
    {
      icon: LayoutDashboard,
      label: 'Resumen',
      active: pathname === '/admin',
      onClick: () => router.push('/admin'),
    },
    {
      icon: RefreshCw,
      label: 'Operaciones',
      active: pathname.startsWith('/admin/operaciones'),
      onClick: () => router.push('/admin/operaciones'),
    },
    {
      icon: Building2,
      label: 'Empresas',
      active: pathname.startsWith('/admin/empresas'),
      onClick: () => router.push('/admin/empresas'),
    },
    {
      icon: Users,
      label: 'Usuarios',
      active: pathname.startsWith('/admin/usuarios'),
      onClick: () => router.push('/admin/usuarios'),
    },
    ...(showBackToDashboard
      ? [{
          icon: ArrowLeft,
          label: 'Volver al dashboard',
          active: false,
          onClick: () => router.push('/dashboard'),
        }]
      : []),
    {
      icon: LogOut,
      label: 'Salir',
      active: false,
      onClick: handleLogout,
    },
  ]

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 50,
      pointerEvents: 'none',
    }}>
      <div style={{ pointerEvents: 'auto' }}>
        <Dock items={items} />
      </div>
    </div>
  )
}
