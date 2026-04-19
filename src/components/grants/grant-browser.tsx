'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Grant } from '@/lib/types'
import Link from 'next/link'
import { formatCurrency, daysUntil, daysUntilOpen, grantTypeLabel } from '@/lib/utils'
import type { GrantSearchResult } from '@/app/api/grants/search/route'

// ── Types & constants ────────────────────────────────────────────────────────

type SortBy = 'relevancia' | 'deadline' | 'amount' | 'difficulty'
type ViewMode = 'para_mi' | 'todas'

const AMOUNT_PRESETS = [
  { label: 'Cualquier importe', value: 0 },
  { label: '> 10.000 €', value: 10_000 },
  { label: '> 50.000 €', value: 50_000 },
  { label: '> 200.000 €', value: 200_000 },
  { label: '> 500.000 €', value: 500_000 },
]

const SCOPE_OPTIONS = [
  { value: '', label: 'Todos los ámbitos' },
  { value: 'nacional', label: '🇪🇸 Nacional' },
  { value: 'autonomico', label: '📍 Autonómico' },
  { value: 'europeo', label: '🇪🇺 Europeo' },
  { value: 'municipal', label: '🏙️ Municipal' },
]

const TYPE_OPTIONS = [
  { value: '', label: 'Todos los tipos' },
  { value: 'fondo_perdido', label: 'Fondo perdido' },
  { value: 'prestamo', label: 'Préstamo' },
  { value: 'mixto', label: 'Mixto' },
  { value: 'bonificacion', label: 'Bonificación' },
]

// ── Hook: debounce ───────────────────────────────────────────────────────────

function useDebounce<T>(value: T, ms: number): T {
  const [dv, setDv] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDv(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return dv
}

// ── Main component ───────────────────────────────────────────────────────────

interface Props {
  hasMatches: boolean
  matchCount: number
}

export default function GrantBrowser({ hasMatches, matchCount }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>(hasMatches ? 'para_mi' : 'todas')
  const [search, setSearch] = useState('')
  const [scope, setScope] = useState('')
  const [grantType, setGrantType] = useState('')
  const [status, setStatus] = useState('abierta')
  const [minAmount, setMinAmount] = useState(0)
  const [sortBy, setSortBy] = useState<SortBy>(hasMatches ? 'relevancia' : 'deadline')
  const [showFilters, setShowFilters] = useState(false)

  const [grants, setGrants] = useState<GrantSearchResult[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const debouncedSearch = useDebounce(search, 350)
  const abortRef = useRef<AbortController | null>(null)

  // Build query string
  const buildQS = useCallback((p: number) => {
    const qs = new URLSearchParams()
    if (debouncedSearch) qs.set('q', debouncedSearch)
    if (scope) qs.set('scope', scope)
    if (grantType) qs.set('grant_type', grantType)
    if (status) qs.set('status', status)
    if (minAmount > 0) qs.set('min_amount', String(minAmount))
    qs.set('para_mi', viewMode === 'para_mi' ? 'true' : 'false')
    qs.set('sort', sortBy)
    qs.set('page', String(p))
    return qs.toString()
  }, [debouncedSearch, scope, grantType, status, minAmount, viewMode, sortBy])

  // Fetch first page (reset)
  const fetchFirst = useCallback(async () => {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/grants/search?${buildQS(0)}`, { signal: ctrl.signal })
      if (!res.ok) throw new Error('Error al buscar')
      const data = await res.json()
      setGrants(data.grants)
      setTotal(data.total)
      setHasMore(data.hasMore)
      setPage(0)
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setError('Error al cargar subvenciones.')
    } finally {
      setLoading(false)
    }
  }, [buildQS])

  // Load next page
  const fetchMore = useCallback(async () => {
    setLoadingMore(true)
    try {
      const nextPage = page + 1
      const res = await fetch(`/api/grants/search?${buildQS(nextPage)}`)
      if (!res.ok) throw new Error('Error al cargar más')
      const data = await res.json()
      setGrants(prev => [...prev, ...data.grants])
      setHasMore(data.hasMore)
      setPage(nextPage)
    } finally {
      setLoadingMore(false)
    }
  }, [buildQS, page])

  // Re-fetch on any filter change
  useEffect(() => { fetchFirst() }, [fetchFirst])

  const activeFilterCount = [scope, grantType, minAmount > 0 ? '1' : ''].filter(Boolean).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── View mode tabs ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          display: 'inline-flex', background: 'var(--bg-3)',
          borderRadius: 10, padding: 3, gap: 2,
        }}>
          {hasMatches && (
            <button
              onClick={() => { setViewMode('para_mi'); setSortBy('relevancia') }}
              style={{
                padding: '6px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500,
                border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
                background: viewMode === 'para_mi' ? 'var(--bg)' : 'transparent',
                color: viewMode === 'para_mi' ? 'var(--accent-ink)' : 'var(--fg-3)',
                boxShadow: viewMode === 'para_mi' ? 'var(--shadow-sm)' : 'none',
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>
              Para mí
              <span style={{
                fontSize: 11, padding: '1px 6px', borderRadius: 999, fontWeight: 600,
                background: viewMode === 'para_mi' ? 'var(--accent-soft-2)' : 'var(--line)',
                color: viewMode === 'para_mi' ? 'var(--accent-ink)' : 'var(--fg-3)',
              }}>{matchCount}</span>
            </button>
          )}
          <button
            onClick={() => { setViewMode('todas'); setSortBy('deadline') }}
            style={{
              padding: '6px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500,
              border: 'none', cursor: 'pointer',
              background: viewMode === 'todas' ? 'var(--bg)' : 'transparent',
              color: viewMode === 'todas' ? 'var(--fg)' : 'var(--fg-3)',
              boxShadow: viewMode === 'todas' ? 'var(--shadow-sm)' : 'none',
            }}
          >
            Todas las subvenciones
          </button>
        </div>
      </div>

      {/* ── Search bar ── */}
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', gap: 8,
          background: 'var(--bg)', border: '1px solid var(--line-2)', borderRadius: 10,
          padding: '0 12px',
        }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--fg-4)" strokeWidth="1.75">
            <circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={viewMode === 'para_mi'
              ? 'Buscar entre mis subvenciones compatibles…'
              : 'Buscar por nombre, organismo, sector, palabras clave…'}
            style={{
              flex: 1, border: 'none', background: 'transparent', outline: 'none',
              fontSize: 14, color: 'var(--fg)', padding: '10px 0',
              fontFamily: 'inherit',
            }}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              style={{ background: 'none', border: 'none', color: 'var(--fg-4)', cursor: 'pointer', fontSize: 16, padding: '0 4px' }}
            >×</button>
          )}
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '0 14px', height: 42,
            border: `1px solid ${showFilters || activeFilterCount > 0 ? 'var(--accent)' : 'var(--line-2)'}`,
            borderRadius: 10, fontSize: 13, fontWeight: 500, cursor: 'pointer',
            background: showFilters || activeFilterCount > 0 ? 'var(--accent-soft)' : 'var(--bg)',
            color: showFilters || activeFilterCount > 0 ? 'var(--accent-ink)' : 'var(--fg-2)',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
            <line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/>
          </svg>
          Filtros {activeFilterCount > 0 && `(${activeFilterCount})`}
        </button>
      </div>

      {/* ── Filter panel ── */}
      {showFilters && (
        <div style={{
          background: 'var(--bg)', border: '1px solid var(--line)',
          borderRadius: 12, padding: 18, display: 'flex', flexDirection: 'column', gap: 14,
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            <div>
              <label style={{ fontSize: 11, color: 'var(--fg-3)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500 }}>Ámbito</label>
              <select
                value={scope}
                onChange={e => setScope(e.target.value)}
                style={{ width: '100%', height: 36, fontSize: 13, borderRadius: 8, border: '1px solid var(--line-2)', background: 'var(--bg)', color: 'var(--fg)', padding: '0 8px', fontFamily: 'inherit' }}
              >
                {SCOPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--fg-3)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500 }}>Tipo de ayuda</label>
              <select
                value={grantType}
                onChange={e => setGrantType(e.target.value)}
                style={{ width: '100%', height: 36, fontSize: 13, borderRadius: 8, border: '1px solid var(--line-2)', background: 'var(--bg)', color: 'var(--fg)', padding: '0 8px', fontFamily: 'inherit' }}
              >
                {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--fg-3)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500 }}>Estado</label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value)}
                style={{ width: '100%', height: 36, fontSize: 13, borderRadius: 8, border: '1px solid var(--line-2)', background: 'var(--bg)', color: 'var(--fg)', padding: '0 8px', fontFamily: 'inherit' }}
              >
                <option value="">Todos</option>
                <option value="abierta">Abiertas ahora</option>
                <option value="proxima">Próximas</option>
              </select>
            </div>
          </div>

          {/* Amount presets */}
          <div>
            <label style={{ fontSize: 11, color: 'var(--fg-3)', display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500 }}>Importe mínimo por empresa</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {AMOUNT_PRESETS.map(p => (
                <button
                  key={p.value}
                  onClick={() => setMinAmount(p.value)}
                  style={{
                    padding: '5px 12px', borderRadius: 999, fontSize: 12.5, fontWeight: 500,
                    border: `1px solid ${minAmount === p.value ? 'var(--accent)' : 'var(--line-2)'}`,
                    background: minAmount === p.value ? 'var(--accent-soft)' : 'var(--bg)',
                    color: minAmount === p.value ? 'var(--accent-ink)' : 'var(--fg-2)',
                    cursor: 'pointer',
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {(scope || grantType || minAmount > 0 || status !== 'abierta') && (
            <button
              onClick={() => { setScope(''); setGrantType(''); setMinAmount(0); setStatus('abierta') }}
              style={{ alignSelf: 'flex-start', background: 'none', border: 'none', fontSize: 12.5, color: 'var(--fg-3)', cursor: 'pointer', textDecoration: 'underline' }}
            >
              Limpiar filtros
            </button>
          )}
        </div>
      )}

      {/* ── Sort bar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, color: 'var(--fg-3)', fontWeight: 500 }}>Ordenar:</span>
        {([
          { value: 'relevancia', label: 'Relevancia', show: hasMatches },
          { value: 'deadline', label: 'Plazo cierre', show: true },
          { value: 'amount', label: 'Mayor importe', show: true },
          { value: 'difficulty', label: 'Más fáciles', show: true },
        ] as const).filter(o => o.show).map(opt => (
          <button
            key={opt.value}
            onClick={() => setSortBy(opt.value)}
            style={{
              padding: '4px 12px', borderRadius: 999, fontSize: 12, fontWeight: 500, cursor: 'pointer',
              border: `1px solid ${sortBy === opt.value ? 'var(--accent)' : 'var(--line)'}`,
              background: sortBy === opt.value ? 'var(--accent-soft)' : 'transparent',
              color: sortBy === opt.value ? 'var(--accent-ink)' : 'var(--fg-3)',
            }}
          >
            {opt.label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: 'var(--fg-3)', fontFamily: 'var(--font-geist-mono), monospace' }}>
          {loading ? '…' : `${total.toLocaleString('es-ES')} subvenciones`}
          {viewMode === 'para_mi' && !loading && <span style={{ color: 'var(--accent)', fontWeight: 500 }}> compatibles</span>}
        </span>
      </div>

      {/* ── Error state ── */}
      {error && (
        <div style={{ padding: '14px 16px', borderRadius: 10, background: 'oklch(0.95 0.05 25)', border: '1px solid oklch(0.9 0.08 25)', color: 'var(--danger)', fontSize: 13 }}>
          {error} <button onClick={fetchFirst} style={{ color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, marginLeft: 8 }}>Reintentar</button>
        </div>
      )}

      {/* ── Loading skeleton ── */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{
              height: 100, background: 'var(--bg)', border: '1px solid var(--line)',
              borderRadius: 12, animation: 'pulse 1.5s ease-in-out infinite',
            }} />
          ))}
        </div>
      )}

      {/* ── Empty state ── */}
      {!loading && grants.length === 0 && !error && (
        <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--fg-3)' }}>
          <div style={{
            width: 48, height: 48, borderRadius: '50%', background: 'var(--bg-3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px',
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
          </div>
          <p style={{ fontWeight: 500, color: 'var(--fg-2)', marginBottom: 4 }}>
            {viewMode === 'para_mi' ? 'No hay subvenciones compatibles con los filtros actuales' : 'Sin resultados para esta búsqueda'}
          </p>
          <p style={{ fontSize: 12.5 }}>
            {viewMode === 'para_mi'
              ? 'Prueba a ampliar los filtros o cambia a "Todas las subvenciones"'
              : 'Prueba con otros términos o elimina algunos filtros'}
          </p>
          {viewMode === 'para_mi' && (
            <Link href="/dashboard/empresa" style={{
              display: 'inline-flex', marginTop: 14, padding: '8px 16px', borderRadius: 8,
              border: '1px solid var(--line)', background: 'var(--bg)', fontSize: 13, color: 'var(--fg)',
              textDecoration: 'none',
            }}>
              Actualizar perfil de empresa →
            </Link>
          )}
        </div>
      )}

      {/* ── Results ── */}
      {!loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {grants.map(grant => (
            <GrantCard key={grant.id} grant={grant} />
          ))}
        </div>
      )}

      {/* ── Load more ── */}
      {!loading && hasMore && (
        <div style={{ textAlign: 'center', paddingTop: 8 }}>
          <button
            onClick={fetchMore}
            disabled={loadingMore}
            style={{
              padding: '10px 28px', borderRadius: 10, fontSize: 13.5, fontWeight: 500,
              border: '1px solid var(--line-2)', background: 'var(--bg)', color: 'var(--fg-2)',
              cursor: loadingMore ? 'not-allowed' : 'pointer',
            }}
          >
            {loadingMore ? 'Cargando…' : 'Cargar más subvenciones'}
          </button>
        </div>
      )}

    </div>
  )
}

// ── Grant Card ───────────────────────────────────────────────────────────────

function GrantCard({ grant }: { grant: GrantSearchResult }) {
  const days = daysUntil(grant.deadline)
  const daysToOpen = grant.status === 'proxima' ? daysUntilOpen(grant.opening_date) : null
  const isEffectivelyClosed = days !== null && days < 0
  const isProxima = grant.status === 'proxima'

  const score = grant.eligibility_score
  const hasScore = score !== undefined && score > 0

  const scoreColor = hasScore
    ? score >= 70 ? 'oklch(0.65 0.14 150)'   // green
    : score >= 50 ? 'var(--accent)'           // amber
    : 'var(--fg-4)'                           // muted
    : 'var(--fg-4)'

  const scoreLabel = hasScore
    ? score >= 70 ? 'Alta afinidad'
    : score >= 50 ? 'Compatible'
    : 'Posible'
    : null

  const urgencyColor = days === null ? 'var(--fg-4)'
    : days <= 7 ? 'var(--danger)'
    : days <= 20 ? 'var(--warn)'
    : 'oklch(0.65 0.14 150)'

  const typeColorMap: Record<string, string> = {
    fondo_perdido: 'oklch(0.95 0.05 150)',
    prestamo: 'var(--info-soft)',
    mixto: 'var(--accent-soft)',
    bonificacion: 'oklch(0.95 0.04 270)',
    aval: 'var(--bg-3)',
  }

  return (
    <Link
      href={`/dashboard/subvenciones/${grant.id}`}
      style={{
        display: 'block', textDecoration: 'none',
        background: 'var(--bg)', border: '1px solid var(--line)',
        borderRadius: 12, overflow: 'hidden',
        transition: 'box-shadow .12s ease, border-color .12s ease',
        opacity: isEffectivelyClosed ? 0.55 : 1,
      }}
    >
      {/* Score bar at top */}
      {hasScore && (
        <div style={{ height: 3, background: 'var(--bg-3)' }}>
          <div style={{
            width: `${score}%`, height: '100%',
            background: scoreColor, transition: 'width .3s ease',
          }} />
        </div>
      )}

      <div style={{ padding: '14px 16px', display: 'grid', gridTemplateColumns: '1fr auto', gap: 16, alignItems: 'start' }}>
        {/* Left */}
        <div style={{ minWidth: 0 }}>
          {/* Chips row */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 7 }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, padding: '2px 8px',
              borderRadius: 999, fontWeight: 500,
              background: typeColorMap[grant.grant_type] ?? 'var(--bg-3)', color: 'var(--fg-2)',
            }}>
              {grantTypeLabel(grant.grant_type)}
            </span>
            <span style={{
              fontSize: 11, padding: '2px 8px', borderRadius: 999, fontWeight: 500,
              background: 'var(--bg-3)', color: 'var(--fg-3)',
            }}>
              {grant.scope}
            </span>
            {hasScore && scoreLabel && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11,
                padding: '2px 8px', borderRadius: 999, fontWeight: 600,
                background: score >= 70 ? 'var(--good-soft)' : 'var(--accent-soft)',
                color: score >= 70 ? 'oklch(0.35 0.12 150)' : 'var(--accent-ink)',
              }}>
                <span style={{ fontSize: 10 }}>●</span>
                {scoreLabel} · {score}%
              </span>
            )}
          </div>

          <h3 style={{ fontSize: 14, fontWeight: 500, color: 'var(--fg)', margin: 0, lineHeight: 1.35 }}>
            {grant.title}
          </h3>
          <p style={{ fontSize: 12, color: 'var(--fg-3)', margin: '3px 0 0', letterSpacing: 0 }}>
            {grant.organismo}
          </p>

          {grant.summary && (
            <p style={{
              fontSize: 12.5, color: 'var(--fg-2)', lineHeight: 1.45,
              margin: '8px 0 0',
              display: '-webkit-box', WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }}>
              {grant.summary}
            </p>
          )}

          {/* Score bar inline */}
          {hasScore && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
              <div style={{ flex: 1, height: 5, background: 'var(--bg-3)', borderRadius: 3, maxWidth: 180 }}>
                <div style={{
                  width: `${score}%`, height: '100%',
                  borderRadius: 3, background: scoreColor,
                }} />
              </div>
              <span style={{ fontSize: 11, color: 'var(--fg-3)', fontFamily: 'var(--font-geist-mono), monospace' }}>
                {score}% afinidad
              </span>
            </div>
          )}
        </div>

        {/* Right */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
          {grant.budget_per_company_max ? (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: 'var(--fg-4)' }}>Hasta</div>
              <div style={{
                fontSize: 17, fontWeight: 500, letterSpacing: '-0.015em',
                fontFamily: 'var(--font-geist-mono), monospace',
                color: 'oklch(0.35 0.12 150)',
              }}>
                {formatCurrency(grant.budget_per_company_max)}
              </div>
            </div>
          ) : grant.budget_total ? (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: 'var(--fg-4)' }}>Presupuesto total</div>
              <div style={{ fontSize: 15, fontWeight: 500, fontFamily: 'var(--font-geist-mono), monospace', color: 'var(--fg-2)' }}>
                {formatCurrency(grant.budget_total)}
              </div>
            </div>
          ) : null}

          {/* Status */}
          {isProxima && daysToOpen !== null ? (
            <span style={{ fontSize: 11.5, padding: '3px 8px', borderRadius: 6, background: 'var(--info-soft)', color: 'var(--info)', fontWeight: 500 }}>
              Abre en {daysToOpen <= 0 ? 'hoy' : `${daysToOpen}d`}
            </span>
          ) : isEffectivelyClosed ? (
            <span style={{ fontSize: 11.5, padding: '3px 8px', borderRadius: 6, background: 'var(--bg-3)', color: 'var(--fg-3)', fontWeight: 500 }}>
              Plazo vencido
            </span>
          ) : days !== null ? (
            <span style={{
              fontSize: 11.5, padding: '3px 8px', borderRadius: 6, fontWeight: 500,
              background: days <= 7 ? 'oklch(0.95 0.05 25)' : days <= 20 ? 'var(--accent-soft)' : 'var(--good-soft)',
              color: urgencyColor,
            }}>
              {days === 0 ? 'Cierra hoy' : `Cierra en ${days}d`}
            </span>
          ) : (
            <span style={{ fontSize: 11.5, padding: '3px 8px', borderRadius: 6, background: 'var(--good-soft)', color: 'var(--good)', fontWeight: 500 }}>
              Abierta
            </span>
          )}

          {grant.success_rate != null && (
            <span style={{ fontSize: 11, color: 'var(--fg-4)', fontFamily: 'var(--font-geist-mono), monospace' }}>
              {grant.success_rate.toFixed(0)}% aprobación hist.
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
