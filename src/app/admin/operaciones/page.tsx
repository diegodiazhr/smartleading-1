import Header from '@/components/dashboard/header'
import { OperacionesPanel } from '@/app/dashboard/admin/operaciones/_panel'

export default function AdminOperacionesPage() {
  return (
    <div>
      <Header title="Admin · Operaciones" subtitle="Sincronización, matching y enriquecimiento de datos" />
      <div style={{ padding: '24px 28px 48px' }}>
        <OperacionesPanel />
      </div>
    </div>
  )
}
