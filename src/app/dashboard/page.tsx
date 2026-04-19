import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Header from '@/components/dashboard/header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import {
  TrendingUp,
  FileText,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ChevronRight,
  Euro,
  Target,
  Zap,
  Sparkles,
} from 'lucide-react'
import { redirect } from 'next/navigation'
import { formatCurrency, formatDate, daysUntil, urgencyLabel, statusLabel } from '@/lib/utils'
import type { GrantMatch } from '@/lib/types'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const admin = createAdminClient()

  // Get company for matched grants
  const { data: userRecord } = await admin
    .from('users')
    .select('organization_id')
    .eq('id', user.id)
    .single()

  const { data: company } = userRecord?.organization_id
    ? await admin.from('companies').select('id, name').eq('organization_id', userRecord.organization_id).single()
    : { data: null }

  const [applicationsResult, alertsResult, tasksResult, matchesResult] = await Promise.all([
    supabase
      .from('applications')
      .select('*, grant:grants(title, deadline, budget_per_company_max)')
      .order('updated_at', { ascending: false })
      .limit(10),
    supabase
      .from('alerts')
      .select('*, grant:grants(title)')
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('tasks')
      .select('*')
      .neq('status', 'completed')
      .order('due_date', { ascending: true })
      .limit(5),
    company
      ? admin
          .from('company_grant_matches')
          .select('*, grant:grants(*)')
          .eq('company_id', company.id)
          .gte('eligibility_score', 40)
          .order('eligibility_score', { ascending: false })
          .limit(50)
      : Promise.resolve({ data: [] }),
  ])

  const applications = applicationsResult.data || []
  const alerts = alertsResult.data || []
  const tasks = tasksResult.data || []
  const matches = (matchesResult.data || []) as (GrantMatch & { grant: import('@/lib/types').Grant })[]

  const totalRequested = applications.reduce((s, a) => s + (a.requested_amount || 0), 0)
  const totalApproved = applications
    .filter(a => ['approved', 'pending_justification', 'justified'].includes(a.status))
    .reduce((s, a) => s + (a.approved_amount || 0), 0)
  const activeApps = applications.filter(a => !['closed', 'denied'].includes(a.status)).length

  const totalPotential = matches.reduce((s, m) => s + (m.potential_amount || 0), 0)
  const highFitMatches = matches.filter(m => m.eligibility_score >= 70)

  // Top urgent matched grants (deadline within 30 days)
  const urgentMatches = matches
    .filter(m => m.grant && daysUntil(m.grant.deadline) !== null && (daysUntil(m.grant.deadline) ?? 999) <= 30)
    .sort((a, b) => (daysUntil(a.grant?.deadline) ?? 999) - (daysUntil(b.grant?.deadline) ?? 999))
    .slice(0, 3)

  const hasMatches = matches.length > 0

  return (
    <div className="flex flex-col h-full overflow-auto">
      <Header title="Dashboard" subtitle={`Bienvenido${company ? `, ${company.name}` : ''}`} />

      <div className="flex-1 p-6 space-y-6">
        {/* Banner potencial */}
        <div className="bg-gradient-to-r from-indigo-600 to-indigo-500 rounded-xl p-5 text-white flex items-center justify-between">
          <div>
            <p className="text-indigo-100 text-sm font-medium">
              {hasMatches ? 'Subvenciones compatibles con tu empresa' : 'Subvenciones detectadas para tu empresa'}
            </p>
            <p className="text-3xl font-bold mt-0.5">
              {hasMatches ? formatCurrency(totalPotential) : 'Ejecuta el matching'}
            </p>
            <p className="text-indigo-200 text-sm mt-1">
              {hasMatches
                ? `${matches.length} convocatorias compatibles · ${highFitMatches.length} de alta afinidad`
                : 'Ve a Mi Empresa y pulsa "Recalcular matching"'}
            </p>
          </div>
          <div className="hidden md:flex flex-col items-end gap-2">
            <Euro className="w-12 h-12 text-indigo-300" />
            <Link href={hasMatches ? '/dashboard/subvenciones' : '/dashboard/empresa'}>
              <Button variant="outline" size="sm" className="bg-white/10 border-white/20 text-white hover:bg-white/20">
                {hasMatches ? 'Ver oportunidades' : 'Configurar empresa'} <ChevronRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Compatibles</p>
                <Target className="w-4 h-4 text-indigo-500" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{matches.length}</p>
              <p className="text-xs text-gray-500 mt-0.5">Convocatorias elegibles</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Solicitado</p>
                <FileText className="w-4 h-4 text-blue-500" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalRequested)}</p>
              <p className="text-xs text-gray-500 mt-0.5">{applications.length} expedientes</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Concedido</p>
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalApproved)}</p>
              <p className="text-xs text-emerald-600 mt-0.5">Fondos aprobados</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Activos</p>
                <TrendingUp className="w-4 h-4 text-amber-500" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{activeApps}</p>
              <p className="text-xs text-gray-500 mt-0.5">Expedientes en curso</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Urgentes + Expedientes */}
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-500" />
                    Acción urgente
                  </CardTitle>
                  <Link href="/dashboard/subvenciones" className="text-xs text-indigo-600 hover:underline">
                    Ver todas →
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {urgentMatches.length > 0 ? (
                  <div className="space-y-3">
                    {urgentMatches.map((match) => {
                      const grant = match.grant
                      const days = daysUntil(grant?.deadline)
                      const { label: urgLabel, color: urgColor } = urgencyLabel(days)
                      return (
                        <div key={match.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <p className="text-sm font-medium text-gray-900 truncate">{grant?.title}</p>
                              <MatchBadge score={match.eligibility_score} />
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-500">{grant?.organismo}</span>
                              {grant?.budget_per_company_max && (
                                <span className="text-xs text-emerald-600 font-medium">
                                  Hasta {formatCurrency(grant.budget_per_company_max)}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 ml-3">
                            <div className="text-right">
                              <Clock className={`w-3.5 h-3.5 ${urgColor} mx-auto`} />
                              <span className={`text-xs font-medium ${urgColor}`}>{urgLabel}</span>
                            </div>
                            <Link href={`/dashboard/subvenciones/${grant?.id}`}>
                              <Button size="sm" variant="outline">Ver</Button>
                            </Link>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : hasMatches ? (
                  <div className="text-center py-8 text-gray-400">
                    <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-400 opacity-60" />
                    <p className="text-sm">No hay convocatorias urgentes ahora mismo</p>
                    <Link href="/dashboard/subvenciones">
                      <Button variant="outline" size="sm" className="mt-3">Ver todas las compatibles</Button>
                    </Link>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-400">
                    <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">Completa tu perfil para ver subvenciones personalizadas</p>
                    <Link href="/dashboard/empresa">
                      <Button variant="outline" size="sm" className="mt-3">Ir a Mi Empresa</Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>

            {applications.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">Expedientes recientes</CardTitle>
                    <Link href="/dashboard/expedientes" className="text-xs text-indigo-600 hover:underline">
                      Ver todos →
                    </Link>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-2">
                    {applications.slice(0, 4).map((app) => {
                      const { label, color } = statusLabel(app.status)
                      return (
                        <div key={app.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {(app.grant as { title?: string })?.title || 'Subvención sin título'}
                            </p>
                            <p className="text-xs text-gray-500">{formatDate(app.created_at)}</p>
                          </div>
                          <div className="flex items-center gap-2 ml-3">
                            {app.requested_amount && (
                              <span className="text-xs text-gray-600 font-medium">
                                {formatCurrency(app.requested_amount)}
                              </span>
                            )}
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${color}`}>{label}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar: Alertas + Tareas */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  Alertas ({alerts.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {alerts.length > 0 ? (
                  <div className="space-y-2">
                    {alerts.map((alert) => (
                      <div key={alert.id} className="p-2.5 bg-amber-50 rounded-lg border border-amber-100">
                        <p className="text-xs font-medium text-amber-900">{alert.title}</p>
                        {alert.message && (
                          <p className="text-xs text-amber-700 mt-0.5 line-clamp-2">{alert.message}</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 text-center py-4">Sin alertas pendientes</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Clock className="w-4 h-4 text-indigo-500" />
                  Tareas pendientes
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {tasks.length > 0 ? (
                  <div className="space-y-2">
                    {tasks.map((task) => {
                      const days = daysUntil(task.due_date)
                      const { label: urgLabel, color: urgColor } = urgencyLabel(days)
                      return (
                        <div key={task.id} className="flex items-start gap-2">
                          <div className="w-4 h-4 mt-0.5 rounded border-2 border-gray-300 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-gray-900">{task.title}</p>
                            {task.due_date && (
                              <p className={`text-xs ${urgColor}`}>{urgLabel}</p>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 text-center py-4">Sin tareas pendientes</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

function MatchBadge({ score }: { score: number }) {
  if (score >= 70) return <Badge variant="success" className="text-xs px-1.5 py-0">Alta afinidad</Badge>
  if (score >= 50) return <Badge variant="blue" className="text-xs px-1.5 py-0">Compatible</Badge>
  return null
}
