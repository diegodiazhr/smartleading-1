import Link from 'next/link'
import type { CSSProperties } from 'react'
import Header from '@/components/dashboard/header'
import { AdminEmptyState, AdminPill, AdminSectionCard, AdminStatCard } from '@/components/admin/admin-ui'
import { GrantPublisherManager } from '@/app/admin/sistema/_publisher-manager'
import { getGrantSystemOverview, getGrantSystemPublishers } from '@/lib/grant-system'
import { formatDate } from '@/lib/utils'

function pillToneForRun(status: string | null | undefined) {
  if (status === 'success') return 'good' as const
  if (status === 'partial') return 'warn' as const
  if (status === 'error') return 'danger' as const
  if (status === 'running') return 'info' as const
  return 'neutral' as const
}

function pillToneForPublication(status: string) {
  if (status === 'published') return 'good' as const
  if (status === 'enriched') return 'info' as const
  if (status === 'rejected') return 'danger' as const
  return 'warn' as const
}

export default async function AdminSistemaPage() {
  const [overview, publishers] = await Promise.all([
    getGrantSystemOverview(),
    getGrantSystemPublishers(),
  ])

  return (
    <div>
      <Header title="Admin · Sistema" subtitle="Pipeline oficial de discovery, enriquecimiento y publicación de subvenciones" />
      <div style={{ padding: '24px 28px 48px', display: 'grid', gap: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <AdminStatCard label="Publishers activos" value={overview.health.activePublishers} sub="Fuentes oficiales registradas" />
          <AdminStatCard label="Publicadas" value={overview.funnel.published} sub="Convocatorias aptas para búsqueda" color="var(--good)" />
          <AdminStatCard label="Errores recientes" value={overview.health.recentErrors} sub="Últimos 7 días" color={overview.health.recentErrors > 0 ? 'var(--danger)' : 'var(--fg)'} />
          <AdminStatCard
            label="Discovery → published"
            value={overview.health.averageLeadHours ? `${overview.health.averageLeadHours} h` : '—'}
            sub="Tiempo medio desde detección hasta publicación"
          />
        </div>

        <AdminSectionCard title="Salud del pipeline" subtitle="Estado general del sistema y última actividad por nivel administrativo">
          <div style={{ display: 'grid', gap: 14 }}>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Link href="/admin/operaciones" style={actionLinkStyle}>Ir a Operaciones</Link>
              <Link href="/admin/convocatorias" style={actionLinkStyle}>Revisar catálogo</Link>
              <Link href="/admin/auditoria" style={actionLinkStyle}>Abrir auditoría</Link>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
              {Object.entries(overview.health.lastSyncByLevel).map(([level, info]) => (
                <div key={level} style={panelStyle}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg)' }}>{level.toUpperCase()}</div>
                    <AdminPill tone={pillToneForRun(info?.status)}>{info?.status ?? 'sin runs'}</AdminPill>
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--fg-2)' }}>{info?.publisherName ?? 'Sin sincronización registrada'}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--fg-4)', marginTop: 4 }}>
                    {info?.finishedAt ? `Última sync: ${formatDate(info.finishedAt)}` : 'Todavía no hay una ejecución finalizada'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </AdminSectionCard>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(320px, 0.8fr)', gap: 16, alignItems: 'start' }}>
          <AdminSectionCard title="Cobertura oficial" subtitle="Publishers configurados y volumen de convocatorias por nivel">
            <div style={{ display: 'grid', gap: 12 }}>
              {overview.coverage.map(item => (
                <div key={item.level} style={panelStyle}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', marginBottom: 10 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg)' }}>{item.label}</div>
                    <AdminPill tone="accent">{item.configuredPublishers} publishers</AdminPill>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
                    <Metric label="Descubiertas" value={item.discoveredCalls} />
                    <Metric label="Publicadas" value={item.publishedCalls} />
                  </div>
                </div>
              ))}
            </div>
          </AdminSectionCard>

          <AdminSectionCard title="Funnel de calidad" subtitle="Cómo avanza una convocatoria dentro del pipeline">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
              <Metric label="Discovered" value={overview.funnel.discovered} />
              <Metric label="Fetched" value={overview.funnel.fetched} />
              <Metric label="Enriched" value={overview.funnel.enriched} />
              <Metric label="Published" value={overview.funnel.published} tone="good" />
              <Metric label="Rejected" value={overview.funnel.rejected} tone={overview.funnel.rejected > 0 ? 'danger' : 'neutral'} />
            </div>
          </AdminSectionCard>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 0.95fr) minmax(0, 1.05fr)', gap: 16, alignItems: 'start' }}>
          <AdminSectionCard title="Colas y riesgos" subtitle="Lo que hoy está bloqueando publicación o revisión">
            <div style={{ display: 'grid', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
                <Metric label="Pendientes de enriquecer" value={overview.queues.pendingEnrichment} />
                <Metric label="Pendientes de revisión" value={overview.queues.pendingReview} tone="info" />
                <Metric label="Fallos de extracción" value={overview.queues.extractionFailures} tone={overview.queues.extractionFailures > 0 ? 'danger' : 'neutral'} />
                <Metric label="Sin fuente primaria" value={overview.queues.withoutPrimarySource} tone={overview.queues.withoutPrimarySource > 0 ? 'warn' : 'neutral'} />
              </div>

              {overview.riskCalls.length > 0 ? (
                <div style={{ display: 'grid', gap: 10 }}>
                  {overview.riskCalls.map(call => (
                    <Link
                      key={call.id}
                      href={`/admin/sistema/convocatorias/${call.id}`}
                      style={{ ...panelStyle, textDecoration: 'none' }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', marginBottom: 6 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg)' }}>{call.title}</div>
                        <AdminPill tone={pillToneForPublication(call.publicationStatus)}>{call.publicationStatus}</AdminPill>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--fg-4)' }}>
                        {call.source} · {call.scope} · Quality {Math.round(call.qualityScore)}
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--fg-4)', marginTop: 4 }}>
                        {call.hasPrimarySource ? 'Tiene fuente primaria' : 'Sin fuente primaria'} · Actualizada {formatDate(call.updatedAt)}
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <AdminEmptyState>No hay convocatorias en riesgo en este corte.</AdminEmptyState>
              )}
            </div>
          </AdminSectionCard>

          <AdminSectionCard title="Fuentes oficiales" subtitle="Registro de publishers, última ejecución y ratio de publicación">
            <GrantPublisherManager initialPublishers={publishers} />
          </AdminSectionCard>
        </div>
      </div>
    </div>
  )
}

function Metric({ label, value, tone = 'neutral' }: { label: string; value: string | number; tone?: 'neutral' | 'good' | 'info' | 'warn' | 'danger' }) {
  const colors = {
    neutral: 'var(--fg)',
    good: 'var(--good)',
    info: 'var(--info)',
    warn: 'var(--accent-ink)',
    danger: 'var(--danger)',
  } as const

  return (
    <div style={panelStyle}>
      <div style={{ fontSize: 11, color: 'var(--fg-4)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 600, color: colors[tone] }}>{value}</div>
    </div>
  )
}

const panelStyle: CSSProperties = {
  padding: '13px 14px',
  borderRadius: 12,
  border: '1px solid var(--line)',
  background: 'var(--bg)',
}

const actionLinkStyle: CSSProperties = {
  padding: '8px 12px',
  borderRadius: 999,
  border: '1px solid var(--line)',
  textDecoration: 'none',
  fontSize: 12.5,
  color: 'var(--fg)',
  background: 'var(--bg)',
}
