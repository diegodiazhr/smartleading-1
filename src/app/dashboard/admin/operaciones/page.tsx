import Header from '@/components/dashboard/header'
import { AdminNav } from '@/components/admin/admin-nav'
import { OperacionesPanel } from './_panel'

export default function OperacionesPage() {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Header title="Admin · Operaciones" subtitle="Sincronización, matching y enriquecimiento de datos" />
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px 48px' }}>
        <AdminNav />
        <OperacionesPanel />
      </div>
    </div>
  )
}
