import Header from '@/components/dashboard/header'
import { ImportPanel } from './_panel'

export default function ImportarPage() {
  return (
    <div>
      <Header title="Admin · Importar" subtitle="Carga masiva de convocatorias desde Excel o CSV" />
      <div style={{ padding: '24px 28px 48px' }}>
        <ImportPanel />
      </div>
    </div>
  )
}
