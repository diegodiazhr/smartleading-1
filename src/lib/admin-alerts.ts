import { createAdminClient } from '@/lib/supabase/admin'
import { getBdnsSyncStatus } from '@/lib/bdns-sync'

export interface AdminDerivedAlert {
  id: string
  level: 'good' | 'warn' | 'danger'
  title: string
  description: string
  metric: string
  href: string
}

function daysAgo(days: number) {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date.toISOString()
}

export async function getAdminDerivedAlerts(): Promise<AdminDerivedAlert[]> {
  const admin = createAdminClient()
  const syncStatus = await getBdnsSyncStatus()
  const staleMatchThreshold = daysAgo(7)
  const deadlineThreshold = new Date(Date.now() + (7 * 24 * 60 * 60 * 1000)).toISOString().slice(0, 10)

  const [
    { count: grantsMissingSummary },
    { count: grantsMissingSource },
    { count: inactiveUsers },
    { count: closingSoon },
    { data: staleMatches },
    { data: companies },
    { data: matchedCompanies },
  ] = await Promise.all([
    admin.from('grants').select('*', { count: 'exact', head: true }).in('status', ['abierta', 'proxima']).or('summary.is.null,summary.eq.'),
    admin.from('grants').select('*', { count: 'exact', head: true }).in('status', ['abierta', 'proxima']).or('source_url.is.null,source_url.eq.'),
    admin.from('users').select('*', { count: 'exact', head: true }).eq('is_active', false),
    admin.from('grants').select('*', { count: 'exact', head: true }).eq('status', 'abierta').not('deadline', 'is', null).lte('deadline', deadlineThreshold),
    admin
      .from('company_grant_matches')
      .select('company_id, last_calculated')
      .lt('last_calculated', staleMatchThreshold),
    admin.from('companies').select('id'),
    admin.from('company_grant_matches').select('company_id'),
  ])

  const companyIds = new Set((companies ?? []).map(company => company.id))
  const companyIdsWithMatches = new Set((matchedCompanies ?? []).map(match => match.company_id))
  const companiesWithoutMatches = [...companyIds].filter(id => !companyIdsWithMatches.has(id)).length
  const staleCompanies = new Set((staleMatches ?? []).map(match => match.company_id)).size

  const alerts: AdminDerivedAlert[] = []

  if (!syncStatus.lastSyncAt) {
    alerts.push({
      id: 'sync-missing',
      level: 'danger',
      title: 'BDNS aún no se ha sincronizado',
      description: 'El pipeline no ha registrado ninguna sincronización todavía.',
      metric: 'Nunca',
      href: '/admin/operaciones',
    })
  } else {
    const lastSyncMs = new Date(syncStatus.lastSyncAt).getTime()
    const hoursSince = Math.floor((Date.now() - lastSyncMs) / (1000 * 60 * 60))
    if (hoursSince >= 24) {
      alerts.push({
        id: 'sync-stale',
        level: hoursSince >= 72 ? 'danger' : 'warn',
        title: 'Sincronización BDNS atrasada',
        description: 'Conviene revisar el pipeline para evitar pérdida de convocatorias recientes.',
        metric: `${hoursSince} h`,
        href: '/admin/operaciones',
      })
    }
  }

  if ((grantsMissingSummary ?? 0) > 0) {
    alerts.push({
      id: 'missing-summary',
      level: (grantsMissingSummary ?? 0) > 25 ? 'warn' : 'good',
      title: 'Convocatorias pendientes de enriquecer',
      description: 'Hay ayudas activas sin resumen útil para negocio.',
      metric: String(grantsMissingSummary ?? 0),
      href: '/admin/convocatorias',
    })
  }

  if ((grantsMissingSource ?? 0) > 0) {
    alerts.push({
      id: 'missing-source',
      level: 'warn',
      title: 'Convocatorias sin fuente enlazada',
      description: 'Faltan URLs oficiales para revisar la documentación original.',
      metric: String(grantsMissingSource ?? 0),
      href: '/admin/convocatorias',
    })
  }

  if (companiesWithoutMatches > 0) {
    alerts.push({
      id: 'no-matches',
      level: companiesWithoutMatches > 10 ? 'danger' : 'warn',
      title: 'Empresas sin matching calculado',
      description: 'Algunas empresas no tienen oportunidades evaluadas todavía.',
      metric: String(companiesWithoutMatches),
      href: '/admin/empresas',
    })
  }

  if (staleCompanies > 0) {
    alerts.push({
      id: 'stale-matching',
      level: 'warn',
      title: 'Matching desactualizado',
      description: 'Conviene recalcular empresas cuyo análisis se quedó antiguo.',
      metric: String(staleCompanies),
      href: '/admin/operaciones',
    })
  }

  if ((inactiveUsers ?? 0) > 0) {
    alerts.push({
      id: 'inactive-users',
      level: 'warn',
      title: 'Usuarios desactivados',
      description: 'Hay cuentas bloqueadas o pendientes de revisión.',
      metric: String(inactiveUsers ?? 0),
      href: '/admin/usuarios',
    })
  }

  if ((closingSoon ?? 0) > 0) {
    alerts.push({
      id: 'closing-soon',
      level: 'good',
      title: 'Convocatorias abiertas que cierran pronto',
      description: 'Puede haber expedientes que necesiten prioridad comercial u operativa.',
      metric: String(closingSoon ?? 0),
      href: '/admin/convocatorias',
    })
  }

  return alerts
}
