'use client'

import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, RefreshCw, Building2, Building, Users, Upload, ArrowLeft, LogOut, Bell, FileStack, ScrollText, GitBranch } from 'lucide-react'
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
    {
      icon: Upload,
      label: 'Importar',
      active: pathname.startsWith('/admin/importar'),
      onClick: () => router.push('/admin/importar'),
    },
    {
      icon: Bell,
      label: 'Alertas',
      active: pathname.startsWith('/admin/alertas'),
      onClick: () => router.push('/admin/alertas'),
    },
    {
      icon: FileStack,
      label: 'Convocatorias',
      active: pathname.startsWith('/admin/convocatorias'),
      onClick: () => router.push('/admin/convocatorias'),
    },
    {
      icon: GitBranch,
      label: 'Sistema',
      active: pathname.startsWith('/admin/sistema'),
      onClick: () => router.push('/admin/sistema'),
    },
    {
      icon: Building,
      label: 'Organizaciones',
      active: pathname.startsWith('/admin/organizaciones'),
      onClick: () => router.push('/admin/organizaciones'),
    },
    {
      icon: ScrollText,
      label: 'Auditoría',
      active: pathname.startsWith('/admin/auditoria'),
      onClick: () => router.push('/admin/auditoria'),
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
