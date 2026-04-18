import { createClient } from '@/lib/supabase/server'
import Header from '@/components/dashboard/header'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Bell, BellOff, ChevronRight, Clock, FileText, Zap, CheckCircle2 } from 'lucide-react'
import { formatDate } from '@/lib/utils'

const ALERT_ICONS: Record<string, React.ElementType> = {
  new_grant: Zap,
  deadline: Clock,
  subsanacion: FileText,
  document_missing: FileText,
  resolution: CheckCircle2,
  justification_due: Clock,
  grant_opened: Zap,
  match_found: Zap,
}

const ALERT_COLORS: Record<string, string> = {
  new_grant: 'text-indigo-600 bg-indigo-100',
  deadline: 'text-red-600 bg-red-100',
  subsanacion: 'text-amber-600 bg-amber-100',
  document_missing: 'text-amber-600 bg-amber-100',
  resolution: 'text-emerald-600 bg-emerald-100',
  justification_due: 'text-purple-600 bg-purple-100',
  grant_opened: 'text-blue-600 bg-blue-100',
  match_found: 'text-indigo-600 bg-indigo-100',
}

export default async function AlertasPage() {
  const supabase = await createClient()

  const { data: alertsRaw } = await supabase
    .from('alerts')
    .select('*')
    .order('created_at', { ascending: false })

  const alerts = (alertsRaw || []) as Array<{
    id: string; type: string; title: string; message: string | null;
    is_read: boolean; grant_id: string | null; application_id: string | null;
    created_at: string; channels: string[]
  }>

  const unread = alerts.filter(a => !a.is_read)
  const read = alerts.filter(a => a.is_read)

  return (
    <div className="flex flex-col h-full overflow-auto">
      <Header
        title="Alertas"
        subtitle={`${unread.length} sin leer`}
      />

      <div className="flex-1 p-6 max-w-3xl mx-auto w-full space-y-6">
        {alerts?.length === 0 ? (
          <div className="text-center py-20">
            <BellOff className="w-14 h-14 mx-auto mb-4 text-gray-200" />
            <h3 className="font-semibold text-gray-700">Sin alertas</h3>
            <p className="text-sm text-gray-400 mt-1">
              Te notificaremos cuando haya nuevas subvenciones, deadlines próximos o novedades en tus expedientes.
            </p>
          </div>
        ) : (
          <>
            {unread.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <Bell className="w-4 h-4 text-indigo-500" />
                    No leídas ({unread.length})
                  </h3>
                  <Button variant="ghost" size="sm" className="text-xs">Marcar todas como leídas</Button>
                </div>
                <div className="space-y-2">
                  {unread.map(alert => <AlertCard key={alert.id} alert={alert} />)}
                </div>
              </div>
            )}

            {read.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-400 mb-3">Anteriores</h3>
                <div className="space-y-2 opacity-70">
                  {read.map(alert => <AlertCard key={alert.id} alert={alert} />)}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function AlertCard({ alert }: { alert: any }) {
  const Icon = ALERT_ICONS[alert.type] || Bell
  const iconColor = ALERT_COLORS[alert.type] || 'text-gray-600 bg-gray-100'

  return (
    <Card className={!alert.is_read ? 'border-indigo-100 shadow-sm' : ''}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${iconColor}`}>
            <Icon className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium text-gray-900">{alert.title}</p>
              {!alert.is_read && (
                <div className="w-2 h-2 bg-indigo-500 rounded-full mt-1.5 shrink-0" />
              )}
            </div>
            {alert.message && (
              <p className="text-xs text-gray-500 mt-0.5">{alert.message}</p>
            )}
            <div className="flex items-center gap-3 mt-2">
              <p className="text-xs text-gray-400">{formatDate(alert.created_at)}</p>
              {alert.grant_id && (
                <Link href={`/dashboard/subvenciones/${alert.grant_id}`} className="text-xs text-indigo-600 hover:underline flex items-center gap-0.5">
                  Ver subvención <ChevronRight className="w-3 h-3" />
                </Link>
              )}
              {alert.application_id && (
                <Link href={`/dashboard/expedientes/${alert.application_id}`} className="text-xs text-indigo-600 hover:underline flex items-center gap-0.5">
                  Ver expediente <ChevronRight className="w-3 h-3" />
                </Link>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
