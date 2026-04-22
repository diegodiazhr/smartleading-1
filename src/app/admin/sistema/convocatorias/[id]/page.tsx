import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { CSSProperties, ReactNode } from 'react'
import Header from '@/components/dashboard/header'
import { AdminEmptyState, AdminPill, AdminSectionCard } from '@/components/admin/admin-ui'
import { getGrantPipelineCallDetail } from '@/lib/grant-system'
import { formatCurrency, formatDate } from '@/lib/utils'

function pillTone(status: string) {
  if (status === 'published' || status === 'success' || status === 'abierta') return 'good' as const
  if (status === 'enriched' || status === 'running' || status === 'proxima') return 'info' as const
  if (status === 'rejected' || status === 'error' || status === 'cerrada') return 'danger' as const
  return 'warn' as const
}

function scoreTone(score: number) {
  if (score >= 85) return 'good' as const
  if (score >= 65) return 'info' as const
  if (score >= 45) return 'warn' as const
  return 'danger' as const
}

export default async function AdminSistemaConvocatoriaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const detail = await getGrantPipelineCallDetail(id)

  if (!detail) notFound()

  const previewTags = [
    ...(detail.preview?.beneficiary_types ?? []),
    ...(detail.preview?.company_stages ?? []),
    ...(detail.preview?.innovation_themes ?? []),
  ]
  const rawRules = detail.eligibility?.raw_rules
  const structuredRequirements = rawRules && typeof rawRules === 'object' && !Array.isArray(rawRules)
    ? Array.isArray((rawRules as Record<string, unknown>).requirements)
      ? ((rawRules as Record<string, unknown>).requirements as string[])
      : []
    : []

  return (
    <div>
      <Header title="Admin · Sistema · Convocatoria" subtitle="Trazabilidad completa desde discovery hasta publicación" />
      <div style={{ padding: '24px 28px 48px', display: 'grid', gap: 16 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link href="/admin/sistema" style={linkStyle}>Volver al cockpit</Link>
          <Link href="/admin/operaciones" style={linkStyle}>Operaciones</Link>
          <Link href="/admin/convocatorias" style={linkStyle}>Convocatorias</Link>
          <Link href="/admin/auditoria" style={linkStyle}>Auditoría</Link>
        </div>

        <section style={{
          background: 'var(--bg-2)',
          border: '1px solid var(--line)',
          borderRadius: 16,
          padding: '20px 22px',
          display: 'grid',
          gap: 14,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 24, lineHeight: 1.2, color: 'var(--fg)' }}>{detail.call.title}</h1>
              <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <AdminPill tone={pillTone(detail.call.publication_status)}>{detail.call.publication_status}</AdminPill>
                <AdminPill tone={scoreTone(detail.call.quality_score)}>Quality {Math.round(detail.call.quality_score)}</AdminPill>
                <AdminPill tone="neutral">{detail.discovery.publisher?.level ?? detail.preview?.source_level ?? 'estado'}</AdminPill>
                <AdminPill tone="accent">{detail.discovery.publisher?.name ?? detail.call.source}</AdminPill>
              </div>
            </div>

            <div style={{ display: 'grid', gap: 6, minWidth: 220 }}>
              <MetaRow label="Publicable" value={detail.call.publication_status === 'published' ? 'Sí, entra al buscador' : 'No todavía'} />
              <MetaRow label="Deadline" value={formatDate(detail.call.deadline)} />
              <MetaRow label="Fuente preferida" value={detail.preferredSourceRecord?.source_url ?? detail.call.source_url ?? 'Sin URL'} />
            </div>
          </div>
        </section>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 0.95fr) minmax(0, 1.05fr)', gap: 16, alignItems: 'start' }}>
          <AdminSectionCard title="Discovery" subtitle="Cómo se descubrió y consolidó esta convocatoria">
            <div style={{ display: 'grid', gap: 10 }}>
              <MetaRow label="Publisher origen" value={detail.discovery.publisher?.name ?? detail.call.source} />
              <MetaRow label="Authority" value={detail.discovery.publisher?.authority_name ?? detail.call.organismo ?? '—'} />
              <MetaRow label="External IDs" value={detail.discovery.externalIds.join(' · ') || 'Sin external ids'} />
              <MetaRow label="Dedupe key" value={detail.discovery.dedupeKey ?? '—'} mono />
              <MetaRow label="Primera detección" value={formatDate(detail.discovery.firstDetectedAt)} />
              <MetaRow label="Última detección" value={formatDate(detail.discovery.lastDetectedAt)} />
            </div>
          </AdminSectionCard>

          <AdminSectionCard title="Fuentes y documentos" subtitle="Source records persistidos y documentos oficiales descargados">
            <div style={{ display: 'grid', gap: 10 }}>
              {detail.documents.length > 0 ? detail.documents.map(document => (
                <div key={document.id} style={panelStyle}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg)' }}>{document.title ?? detail.call.title}</span>
                      <AdminPill tone={document.is_primary ? 'good' : 'neutral'}>{document.is_primary ? 'Primario' : document.document_type}</AdminPill>
                    </div>
                    <span style={{ fontSize: 11.5, color: 'var(--fg-4)' }}>{document.mime_type ?? 'sin mime'}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--fg-3)', wordBreak: 'break-word' }}>{document.url}</div>
                </div>
              )) : (
                <AdminEmptyState>No hay documentos oficiales asociados todavía.</AdminEmptyState>
              )}

              {detail.sourceRecords.length > 0 && (
                <div style={{ display: 'grid', gap: 8 }}>
                  {detail.sourceRecords.map(record => (
                    <div key={record.id} style={{ ...panelStyle, background: 'var(--bg-2)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                        <div style={{ fontSize: 12.5, color: 'var(--fg-2)' }}>{record.source} · {record.source_kind}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--fg-4)' }}>{formatDate(record.fetched_at)}</div>
                      </div>
                      <div style={{ marginTop: 4, fontSize: 11.5, color: 'var(--fg-4)', wordBreak: 'break-word' }}>
                        {record.source_url ?? 'Sin URL'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </AdminSectionCard>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 16, alignItems: 'start' }}>
          <AdminSectionCard title="Extracción estructurada" subtitle="Lo que ya se ha normalizado para empresa/startup">
            <div style={{ display: 'grid', gap: 12 }}>
              <FieldBlock label="Beneficiarios">
                {detail.eligibility?.beneficiary_types?.length ? pills(detail.eligibility.beneficiary_types) : 'Sin beneficiarios normalizados'}
              </FieldBlock>
              <FieldBlock label="Etapas empresa">
                {detail.eligibility?.company_stages?.length ? pills(detail.eligibility.company_stages) : 'Sin etapas detectadas'}
              </FieldBlock>
              <FieldBlock label="Requisitos">
                {structuredRequirements.length > 0
                  ? structuredRequirements.join(' · ')
                  : detail.documentRequirements.length > 0
                    ? detail.documentRequirements.filter(item => item.is_required).map(item => item.name).join(' · ')
                    : 'Sin requisitos estructurados'}
              </FieldBlock>
              <FieldBlock label="Importes">
                {[
                  detail.funding?.budget_total ? `Presupuesto total ${formatCurrency(Number(detail.funding.budget_total))}` : null,
                  detail.funding?.budget_per_company_max ? `Máx. por empresa ${formatCurrency(Number(detail.funding.budget_per_company_max))}` : null,
                  detail.funding?.grant_intensity_percent ? `${detail.funding.grant_intensity_percent}% intensidad` : null,
                ].filter(Boolean).join(' · ') || 'Sin importe estructurado'}
              </FieldBlock>
              <FieldBlock label="Plazos">
                {[detail.call.opening_date ? `Apertura ${formatDate(detail.call.opening_date)}` : null, detail.call.deadline ? `Cierre ${formatDate(detail.call.deadline)}` : null].filter(Boolean).join(' · ') || 'Sin plazo estructurado'}
              </FieldBlock>
              <FieldBlock label="Documentos requeridos">
                {detail.documentRequirements.length > 0
                  ? detail.documentRequirements.map(item => item.name).join(' · ')
                  : 'Sin documentos estructurados'}
              </FieldBlock>
              <FieldBlock label="Gastos elegibles">
                {detail.expenseRules.filter(item => item.is_eligible).map(item => item.expense_type).join(' · ') || 'Sin gastos elegibles estructurados'}
              </FieldBlock>
            </div>
          </AdminSectionCard>

          <AdminSectionCard title="Evidencias" subtitle="Campo, fragmento y fuente trazable">
            <div style={{ display: 'grid', gap: 10 }}>
              {detail.evidence.length > 0 ? detail.evidence.map(item => (
                <div key={item.id} style={panelStyle}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg)' }}>{item.field_name}</span>
                      <AdminPill tone={scoreTone(Number((item.confidence ?? 0) * 100))}>{Math.round(Number((item.confidence ?? 0) * 100))}% conf.</AdminPill>
                    </div>
                    <span style={{ fontSize: 11.5, color: 'var(--fg-4)' }}>{formatDate(item.last_verified_at)}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--fg-2)', lineHeight: 1.55 }}>{item.evidence_text ?? 'Sin fragmento capturado'}</div>
                  <div style={{ marginTop: 6, fontSize: 11.5, color: 'var(--fg-4)' }}>{item.sourceLabel ?? 'Sin fuente asociada'}</div>
                </div>
              )) : (
                <AdminEmptyState>No se han registrado evidencias para esta convocatoria.</AdminEmptyState>
              )}
            </div>
          </AdminSectionCard>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 0.9fr) minmax(0, 1.1fr)', gap: 16, alignItems: 'start' }}>
          <AdminSectionCard title="Quality gate" subtitle="Checklist visible de publicación y razones de bloqueo">
            <div style={{ display: 'grid', gap: 10 }}>
              {detail.quality.checklist.map(item => (
                <div key={item.key} style={panelStyle}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg)' }}>{item.label}</span>
                    <AdminPill tone={item.passed ? 'good' : 'danger'}>{item.passed ? 'OK' : 'Pendiente'}</AdminPill>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--fg-3)', lineHeight: 1.5 }}>{item.detail}</div>
                </div>
              ))}
              {detail.call.publication_status !== 'published' && (
                <div style={{ ...panelStyle, borderColor: 'var(--danger)' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--danger)', marginBottom: 6 }}>Motivos de no publicación</div>
                  <div style={{ fontSize: 12.5, color: 'var(--fg-2)', lineHeight: 1.6 }}>
                    {detail.quality.rejectionReasons.join(' · ') || 'Todavía no pasa el mínimo de calidad estructurada.'}
                  </div>
                </div>
              )}
            </div>
          </AdminSectionCard>

          <AdminSectionCard title="Preview de búsqueda" subtitle="Cómo se verá en el buscador para empresa/startup">
            {detail.preview ? (
              <div style={{ display: 'grid', gap: 12 }}>
                <div style={{ ...panelStyle, background: 'var(--bg-2)' }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--fg)', marginBottom: 6 }}>{detail.preview.title_public}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--fg-3)', lineHeight: 1.6 }}>
                    {detail.preview.summary_public ?? 'Sin resumen público generado'}
                  </div>
                </div>
                <FieldBlock label="Filtros activados">
                  {previewTags.length > 0 ? pills(previewTags) : 'Sin filtros estructurados'}
                </FieldBlock>
                <FieldBlock label="Territorio">
                  {[detail.preview.source_level, detail.preview.territory, ...(detail.preview.regions ?? [])].filter(Boolean).join(' · ')}
                </FieldBlock>
                <FieldBlock label="CNAE / sectores">
                  {[...(detail.preview.cnae_codes ?? []), ...(detail.preview.sectors ?? [])].join(' · ') || 'Sin CNAE/sectores'}
                </FieldBlock>
                <FieldBlock label="Documentación oficial">
                  {detail.preview.has_official_docs ? `${detail.preview.official_doc_count} documento(s) oficial(es)` : 'Sin documentos oficiales'}
                </FieldBlock>
              </div>
            ) : (
              <AdminEmptyState>Esta convocatoria todavía no tiene entrada en `grant_search_index`.</AdminEmptyState>
            )}
          </AdminSectionCard>
        </div>
      </div>
    </div>
  )
}

function MetaRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: 'grid', gap: 3 }}>
      <div style={{ fontSize: 11, color: 'var(--fg-4)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{
        fontSize: 12.5,
        color: 'var(--fg-2)',
        lineHeight: 1.5,
        wordBreak: 'break-word',
        fontFamily: mono ? 'var(--font-geist-mono)' : undefined,
      }}>{value}</div>
    </div>
  )
}

function FieldBlock({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={panelStyle}>
      <div style={{ fontSize: 11, color: 'var(--fg-4)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 12.5, color: 'var(--fg-2)', lineHeight: 1.55 }}>{children}</div>
    </div>
  )
}

function pills(values: string[]) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {values.map(value => <AdminPill key={value} tone="accent">{value}</AdminPill>)}
    </div>
  )
}

const panelStyle: CSSProperties = {
  padding: '13px 14px',
  borderRadius: 12,
  border: '1px solid var(--line)',
  background: 'var(--bg)',
}

const linkStyle: CSSProperties = {
  padding: '8px 12px',
  borderRadius: 999,
  border: '1px solid var(--line)',
  textDecoration: 'none',
  fontSize: 12.5,
  color: 'var(--fg)',
  background: 'var(--bg-2)',
}
