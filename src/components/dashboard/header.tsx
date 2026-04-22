'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { ArrowUpRight, Bell, HelpCircle, Plus, Search, Sparkles, Workflow } from 'lucide-react'

interface HeaderProps {
  section?: string
  title: string
  subtitle?: string
}

interface SearchResult {
  id: string
  type: 'company' | 'user' | 'grant' | 'application'
  title: string
  subtitle: string
  href: string
}

const TYPE_LABELS: Record<SearchResult['type'], string> = {
  company: 'Empresa',
  user: 'Usuario',
  grant: 'Convocatoria',
  application: 'Expediente',
}

export default function Header({ section = 'Panel', title, subtitle }: HeaderProps) {
  const pathname = usePathname()
  const router = useRouter()
  const isAdmin = pathname.startsWith('/admin')
  const [searchOpen, setSearchOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [settledQuery, setSettledQuery] = useState('')
  const [alertCount, setAlertCount] = useState(0)

  const quickLinks = useMemo(() => (
    isAdmin
      ? [
          { label: 'Resumen', href: '/admin' },
          { label: 'Operaciones', href: '/admin/operaciones' },
          { label: 'Empresas', href: '/admin/empresas' },
          { label: 'Usuarios', href: '/admin/usuarios' },
          { label: 'Convocatorias', href: '/admin/convocatorias' },
        ]
      : [
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Subvenciones', href: '/dashboard/subvenciones' },
          { label: 'Expedientes', href: '/dashboard/expedientes' },
          { label: 'Alertas', href: '/dashboard/alertas' },
        ]
  ), [isAdmin])

  const helpItems = useMemo(() => {
    if (pathname.startsWith('/admin/operaciones')) {
      return [
        'Sincronizar BDNS trae nuevas convocatorias y actualiza las existentes.',
        'Recalcular matching refresca afinidad, filtros duros y potencial económico.',
        'Enriquecer convocatorias mejora títulos y resúmenes para uso comercial.',
      ]
    }
    if (pathname.startsWith('/admin/convocatorias')) {
      return [
        'Revisa primero las abiertas o próximas sin resumen ni fuente.',
        'Los indicadores de calidad ayudan a detectar registros incompletos.',
        'Usa esta vista para priorizar enrichment y validación manual.',
      ]
    }
    if (pathname.startsWith('/admin/usuarios')) {
      return [
        'Solo un superadmin puede cambiar roles o activar/desactivar usuarios.',
        'Última actividad usa `updated_at`, útil como señal operativa rápida.',
        'Filtra por plan y organización para detectar cuentas sensibles.',
      ]
    }
    if (pathname.startsWith('/admin/empresas')) {
      return [
        'La salud del perfil resume cuánta información útil tiene la empresa.',
        'Las empresas sin matching o con matching antiguo son una buena cola de trabajo.',
        'Los filtros ayudan a segmentar por región, CNAE y tipo de empresa.',
      ]
    }
    if (pathname.startsWith('/admin')) {
      return [
        'El resumen combina volumen, salud de datos, alertas y actividad reciente.',
        'Desde aquí puedes detectar cuellos de botella sin salir del panel.',
        'La auditoría registra cambios y ejecuciones del equipo admin.',
      ]
    }
    return [
      'Usa el buscador para moverte rápido entre módulos y entidades.',
      'Las alertas te muestran tareas y riesgos prioritarios.',
      subtitle ?? 'Este panel resume la actividad principal de la plataforma.',
    ]
  }, [pathname, subtitle])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setSearchOpen(true)
      }
      if (event.key === 'Escape') {
        setSearchOpen(false)
        setHelpOpen(false)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    let cancelled = false

    if (!searchOpen || !isAdmin || query.trim().length < 2) return

    const currentQuery = query.trim()
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/search?q=${encodeURIComponent(currentQuery)}`)
        const data = await res.json()
        if (!cancelled) {
          setResults(Array.isArray(data.results) ? data.results : [])
          setSettledQuery(currentQuery)
        }
      } catch {
        if (!cancelled) {
          setResults([])
          setSettledQuery(currentQuery)
        }
      }
    }, 180)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [isAdmin, query, searchOpen])

  useEffect(() => {
    let cancelled = false

    if (!isAdmin) return

    void (async () => {
      try {
        const res = await fetch('/api/admin/alerts-summary')
        const data = await res.json()
        if (!cancelled) {
          setAlertCount(typeof data.count === 'number' ? data.count : 0)
        }
      } catch {
        if (!cancelled) {
          setAlertCount(0)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [isAdmin, pathname])

  const notificationsHref = isAdmin ? '/admin/alertas' : '/dashboard/alertas'
  const searchPlaceholder = isAdmin
    ? 'Buscar empresas, usuarios, convocatorias, expedientes…'
    : 'Buscar ayudas, expedientes, organismos…'
  const displayResults = searchOpen && isAdmin && query.trim().length >= 2 ? results : []
  const displaySearching = searchOpen && isAdmin && query.trim().length >= 2 && query.trim() !== settledQuery

  return (
    <>
      <div style={{
        background: 'var(--bg)',
        borderBottom: '1px solid var(--line)',
        padding: '0 28px',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        height: 53,
        position: 'sticky',
        top: 0,
        zIndex: 10,
        flexShrink: 0,
      }}>
        <div style={{ fontSize: 13, color: 'var(--fg-3)' }}>
          {section} · <b style={{ color: 'var(--fg)', fontWeight: 500 }}>{title}</b>
        </div>

        <div style={{ flex: 1 }} />

        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          style={{
            background: 'var(--bg-2)',
            border: '1px solid var(--line)',
            borderRadius: 8,
            padding: '7px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            minWidth: 320,
            fontSize: 13,
            color: 'var(--fg-3)',
            cursor: 'pointer',
          }}
        >
          <Search size={14} strokeWidth={1.75} />
          <span style={{ flex: 1, textAlign: 'left' }}>{searchPlaceholder}</span>
          <span style={{
            background: 'var(--bg)',
            border: '1px solid var(--line)',
            borderRadius: 4,
            padding: '1px 5px',
            fontSize: 10,
            color: 'var(--fg-3)',
          }}>⌘ K</span>
        </button>

        <button
          type="button"
          onClick={() => setHelpOpen(true)}
          style={{
            width: 34, height: 34, borderRadius: 8,
            border: '1px solid var(--line)',
            background: 'var(--bg)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--fg-2)', cursor: 'pointer',
          }}
          title="Ayuda"
        >
          <HelpCircle size={16} strokeWidth={1.75} />
        </button>

        <Link
          href={notificationsHref}
          style={{
            width: 34, height: 34, borderRadius: 8,
            border: '1px solid var(--line)',
            background: 'var(--bg)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--fg-2)',
            position: 'relative',
          }}
          title="Notificaciones"
        >
          <Bell size={16} strokeWidth={1.75} />
          {(isAdmin ? alertCount > 0 : true) && (
            <span style={{
              position: 'absolute', top: 7, right: 7,
              minWidth: 7, height: 7, borderRadius: 999,
              background: 'var(--accent)',
              border: '2px solid var(--bg)',
              padding: alertCount > 9 ? '0 4px' : 0,
              fontSize: 9,
              color: 'var(--accent-ink)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              {alertCount > 9 ? '9+' : ''}
            </span>
          )}
        </Link>

        <Link href="/dashboard/expedientes" style={{
          background: 'var(--accent)',
          color: 'var(--accent-ink)',
          border: '1px solid var(--accent)',
          padding: '7px 14px',
          borderRadius: 8,
          fontSize: 13,
          fontWeight: 500,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          textDecoration: 'none',
          whiteSpace: 'nowrap',
        }}>
          <Plus size={14} strokeWidth={2} />
          Nuevo expediente
        </Link>
      </div>

      {searchOpen && (
        <div
          onClick={() => setSearchOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'oklch(0.1 0.01 60 / 0.28)',
            zIndex: 80,
            padding: '8vh 24px 24px',
          }}
        >
          <div
            onClick={event => event.stopPropagation()}
            style={{
              maxWidth: 760,
              margin: '0 auto',
              background: 'var(--bg)',
              border: '1px solid var(--line)',
              borderRadius: 18,
              boxShadow: 'var(--shadow-lg)',
              overflow: 'hidden',
            }}
          >
            <div style={{
              padding: '14px 18px',
              borderBottom: '1px solid var(--line)',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}>
              <Search size={16} style={{ color: 'var(--fg-3)', flexShrink: 0 }} />
              <input
                autoFocus
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder={searchPlaceholder}
                style={{
                  border: 'none',
                  outline: 'none',
                  flex: 1,
                  background: 'transparent',
                  color: 'var(--fg)',
                  fontSize: 14,
                }}
              />
              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                style={{
                  border: '1px solid var(--line)',
                  background: 'var(--bg-2)',
                  borderRadius: 8,
                  padding: '5px 9px',
                  fontSize: 11,
                  color: 'var(--fg-3)',
                  cursor: 'pointer',
                }}
              >
                ESC
              </button>
            </div>

            <div style={{ padding: 16, maxHeight: '60vh', overflowY: 'auto' }}>
              {isAdmin && query.trim().length >= 2 ? (
                <>
                  <div style={{ fontSize: 11, color: 'var(--fg-4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
                    Resultados
                  </div>
                  {displaySearching ? (
                    <div style={{ color: 'var(--fg-3)', fontSize: 13 }}>Buscando…</div>
                  ) : displayResults.length > 0 ? (
                    <div style={{ display: 'grid', gap: 8 }}>
                      {displayResults.map(result => (
                        <button
                          key={`${result.type}-${result.id}`}
                          type="button"
                          onClick={() => {
                            setSearchOpen(false)
                            router.push(result.href)
                          }}
                          style={{
                            width: '100%',
                            textAlign: 'left',
                            padding: '12px 14px',
                            borderRadius: 12,
                            border: '1px solid var(--line)',
                            background: 'var(--bg-2)',
                            cursor: 'pointer',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                            <div>
                              <div style={{ fontSize: 13.5, color: 'var(--fg)', fontWeight: 500 }}>{result.title}</div>
                              <div style={{ fontSize: 12, color: 'var(--fg-4)', marginTop: 3 }}>{result.subtitle}</div>
                            </div>
                            <span style={{
                              fontSize: 10.5,
                              padding: '3px 7px',
                              borderRadius: 999,
                              background: 'var(--bg)',
                              border: '1px solid var(--line)',
                              color: 'var(--fg-3)',
                              height: 'fit-content',
                            }}>
                              {TYPE_LABELS[result.type]}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div style={{ color: 'var(--fg-3)', fontSize: 13 }}>No hay resultados para esta búsqueda.</div>
                  )}
                </>
              ) : (
                <>
                  <div style={{ fontSize: 11, color: 'var(--fg-4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
                    Atajos
                  </div>
                  <div style={{ display: 'grid', gap: 8 }}>
                    {quickLinks.map(link => (
                      <button
                        key={link.href}
                        type="button"
                        onClick={() => {
                          setSearchOpen(false)
                          router.push(link.href)
                        }}
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          padding: '12px 14px',
                          borderRadius: 12,
                          border: '1px solid var(--line)',
                          background: 'var(--bg-2)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <span style={{ color: 'var(--fg)', fontWeight: 500 }}>{link.label}</span>
                        <ArrowUpRight size={14} style={{ color: 'var(--fg-4)' }} />
                      </button>
                    ))}
                  </div>
                  {isAdmin && (
                    <div style={{
                      marginTop: 14,
                      padding: '12px 14px',
                      borderRadius: 12,
                      background: 'var(--accent-soft)',
                      border: '1px solid var(--accent-soft-2)',
                      color: 'var(--accent-ink)',
                      fontSize: 12.5,
                      lineHeight: 1.5,
                    }}>
                      Escribe al menos 2 caracteres para buscar en empresas, usuarios, convocatorias y expedientes.
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {helpOpen && (
        <div
          onClick={() => setHelpOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'oklch(0.1 0.01 60 / 0.18)',
            zIndex: 75,
          }}
        >
          <div
            onClick={event => event.stopPropagation()}
            style={{
              position: 'absolute',
              top: 64,
              right: 28,
              width: 360,
              background: 'var(--bg)',
              border: '1px solid var(--line)',
              borderRadius: 16,
              boxShadow: 'var(--shadow-lg)',
              padding: 18,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                background: 'var(--accent-soft)',
                color: 'var(--accent-ink)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                {isAdmin ? <Workflow size={16} /> : <Sparkles size={16} />}
              </div>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--fg)' }}>Ayuda contextual</div>
                <div style={{ fontSize: 12, color: 'var(--fg-4)' }}>{title}</div>
              </div>
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              {helpItems.map(item => (
                <div
                  key={item}
                  style={{
                    padding: '11px 12px',
                    borderRadius: 12,
                    background: 'var(--bg-2)',
                    border: '1px solid var(--line)',
                    color: 'var(--fg-2)',
                    fontSize: 12.5,
                    lineHeight: 1.5,
                  }}
                >
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
