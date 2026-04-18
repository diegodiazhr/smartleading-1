import { createClient } from '@/lib/supabase/server'
import Header from '@/components/dashboard/header'
import JustificacionModule from '@/components/applications/justificacion-module'

export default async function JustificacionPage({
  searchParams,
}: {
  searchParams: Promise<{ appId?: string }>
}) {
  const { appId } = await searchParams
  const supabase = await createClient()

  const [{ data: applications }, { data: invoices }] = await Promise.all([
    supabase
      .from('applications')
      .select('*, grant:grants(id, title, organismo)')
      .in('status', ['pending_justification', 'justified'])
      .order('justification_deadline', { ascending: true }),
    appId
      ? supabase.from('invoices').select('*').eq('application_id', appId).order('invoice_date')
      : Promise.resolve({ data: [] }),
  ])

  const selectedApp = appId
    ? applications?.find(a => a.id === appId)
    : applications?.[0]

  return (
    <div className="flex flex-col h-full overflow-auto">
      <Header title="Justificación" subtitle="Gestiona facturas y documenta tus subvenciones aprobadas" />
      <div className="flex-1 p-6">
        <JustificacionModule
          applications={applications || []}
          selectedAppId={selectedApp?.id || null}
          initialInvoices={invoices || []}
        />
      </div>
    </div>
  )
}
