'use client'

import { useMemo, useState } from 'react'
import type { Grant } from '@/lib/types'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import Link from 'next/link'
import {
  Search,
  Filter,
  Clock,
  ChevronRight,
  Globe,
  MapPin,
  Building,
  Sparkles,
} from 'lucide-react'
import { formatCurrency, daysUntil, daysUntilOpen, urgencyLabel, grantTypeLabel, statusLabel, cn } from '@/lib/utils'

interface Props {
  initialGrants: Grant[]
}

const SCOPES = [
  { value: '', label: 'Todos' },
  { value: 'nacional', label: 'Nacional' },
  { value: 'autonomico', label: 'Autonómico' },
  { value: 'europeo', label: 'Europeo' },
  { value: 'municipal', label: 'Municipal' },
]

const TYPES = [
  { value: '', label: 'Todos los tipos' },
  { value: 'fondo_perdido', label: 'Fondo perdido' },
  { value: 'prestamo', label: 'Préstamo' },
  { value: 'mixto', label: 'Mixto' },
  { value: 'bonificacion', label: 'Bonificación' },
]

const STATUS_FILTER = [
  { value: '', label: 'Todos' },
  { value: 'abierta', label: 'Abiertas' },
  { value: 'proxima', label: 'Próximas' },
]

const TAGS = [
  'digitalización', 'I+D', 'innovación', 'internacionalización',
  'sostenibilidad', 'empleo', 'contratación', 'startup', 'industria', 'energía',
]

export default function GrantBrowser({ initialGrants }: Props) {
  const [search, setSearch] = useState('')
  const [scope, setScope] = useState('')
  const [type, setType] = useState('')
  const [statusFilter, setStatusFilter] = useState('abierta')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [showFilters, setShowFilters] = useState(false)
  const [sortBy, setSortBy] = useState<'deadline' | 'amount' | 'difficulty'>('deadline')

  const filtered = useMemo(() => {
    let grants = [...initialGrants]

    if (search) {
      const q = search.toLowerCase()
      grants = grants.filter(g =>
        g.title.toLowerCase().includes(q) ||
        g.organismo?.toLowerCase().includes(q) ||
        g.summary?.toLowerCase().includes(q) ||
        g.keywords?.some(k => k.toLowerCase().includes(q))
      )
    }

    if (scope) grants = grants.filter(g => g.scope === scope)
    if (type) grants = grants.filter(g => g.grant_type === type)
    if (statusFilter) grants = grants.filter(g => g.status === statusFilter)
    if (selectedTags.length > 0) {
      grants = grants.filter(g =>
        selectedTags.some(tag => g.tags?.includes(tag) || g.keywords?.includes(tag))
      )
    }

    grants.sort((a, b) => {
      if (sortBy === 'deadline') {
        const dA = a.deadline ? new Date(a.deadline).getTime() : Infinity
        const dB = b.deadline ? new Date(b.deadline).getTime() : Infinity
        return dA - dB
      }
      if (sortBy === 'amount') {
        return (b.budget_per_company_max || 0) - (a.budget_per_company_max || 0)
      }
      if (sortBy === 'difficulty') {
        return (a.difficulty_score || 5) - (b.difficulty_score || 5)
      }
      return 0
    })

    return grants
  }, [initialGrants, search, scope, type, statusFilter, selectedTags, sortBy])

  function toggleTag(tag: string) {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    )
  }

  return (
    <div className="space-y-4">
      {/* Search + Actions */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Buscar subvenciones por nombre, organismo, palabras clave..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button
          variant="outline"
          onClick={() => setShowFilters(!showFilters)}
          className={cn(showFilters && 'bg-indigo-50 border-indigo-200 text-indigo-700')}
        >
          <Filter className="w-4 h-4" />
          Filtros
        </Button>
      </div>

      {/* Quick filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs text-gray-500 font-medium">Estado:</span>
        {STATUS_FILTER.map(s => (
          <button
            key={s.value}
            onClick={() => setStatusFilter(s.value)}
            className={cn(
              'text-xs px-3 py-1 rounded-full font-medium transition-colors',
              statusFilter === s.value
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            )}
          >
            {s.label}
          </button>
        ))}
        <span className="text-gray-300">|</span>
        <span className="text-xs text-gray-500 font-medium">Ordenar:</span>
        {[
          { value: 'deadline', label: 'Deadline' },
          { value: 'amount', label: 'Importe' },
          { value: 'difficulty', label: 'Dificultad' },
        ].map(opt => (
          <button
            key={opt.value}
            onClick={() => setSortBy(opt.value as 'deadline' | 'amount' | 'difficulty')}
            className={cn(
              'text-xs px-3 py-1 rounded-full font-medium transition-colors',
              sortBy === opt.value
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Extended filters */}
      {showFilters && (
        <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1.5">Ámbito</label>
              <select
                value={scope}
                onChange={e => setScope(e.target.value)}
                className="w-full h-8 text-sm rounded-lg border border-gray-200 bg-white px-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {SCOPES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1.5">Tipo</label>
              <select
                value={type}
                onChange={e => setType(e.target.value)}
                className="w-full h-8 text-sm rounded-lg border border-gray-200 bg-white px-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 block mb-2">Temáticas</label>
            <div className="flex flex-wrap gap-1.5">
              {TAGS.map(tag => (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={cn(
                    'text-xs px-2.5 py-1 rounded-full transition-colors capitalize',
                    selectedTags.includes(tag)
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white border border-gray-200 text-gray-600 hover:border-indigo-300'
                  )}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Results count */}
      <p className="text-sm text-gray-500">
        <span className="font-semibold text-gray-900">{filtered.length}</span> subvenciones encontradas
      </p>
      <p className="text-xs text-gray-400">
        Datos sincronizados desde infosubvenciones.es (BDNS)
      </p>

      {/* Grant cards */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Search className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Sin resultados</p>
            <p className="text-sm mt-1">Prueba con otros filtros o términos de búsqueda</p>
          </div>
        ) : (
          filtered.map(grant => <GrantCard key={grant.id} grant={grant} />)
        )}
      </div>
    </div>
  )
}

function GrantCard({ grant }: { grant: Grant }) {
  const days = daysUntil(grant.deadline)
  const { label: urgLabel, color: urgColor } = urgencyLabel(days)
  const { label: statusLbl, color: statusColor } = statusLabel(grant.status)
  const daysToOpen = grant.status === 'proxima' ? daysUntilOpen(grant.opening_date) : null

  const scopeIcon = {
    europeo: Globe,
    nacional: Building,
    autonomico: MapPin,
    municipal: MapPin,
  }[grant.scope] || Building

  const ScopeIcon = scopeIcon

  const difficultyLabel = grant.difficulty_score <= 3
    ? { text: 'Fácil', color: 'text-emerald-600' }
    : grant.difficulty_score <= 6
      ? { text: 'Media', color: 'text-amber-600' }
      : { text: 'Alta', color: 'text-red-500' }

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {/* Header row */}
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor}`}>
                {statusLbl}
              </span>
              <Badge variant="secondary" className="gap-1 text-xs">
                <ScopeIcon className="w-3 h-3" />
                {grant.scope}
              </Badge>
              <Badge variant={
                grant.grant_type === 'fondo_perdido' ? 'success' :
                grant.grant_type === 'prestamo' ? 'blue' :
                'warning'
              } className="text-xs">
                {grantTypeLabel(grant.grant_type)}
              </Badge>
            </div>

            {/* Title */}
            <h3 className="font-semibold text-gray-900 text-sm leading-snug">{grant.title}</h3>
            <p className="text-xs text-gray-500 mt-0.5">{grant.organismo}</p>

            {/* Summary */}
            {grant.summary && (
              <p className="text-xs text-gray-600 mt-2 line-clamp-2">{grant.summary}</p>
            )}

            {/* Tags */}
            {grant.tags && grant.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {grant.tags.slice(0, 4).map(tag => (
                  <span key={tag} className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Right panel */}
          <div className="flex flex-col items-end gap-2 shrink-0">
            {/* Amount */}
            {grant.budget_per_company_max && (
              <div className="text-right">
                <p className="text-xs text-gray-400">Hasta</p>
                <p className="text-base font-bold text-emerald-700">
                  {formatCurrency(grant.budget_per_company_max)}
                </p>
              </div>
            )}

            {/* Deadline / Opening */}
            {daysToOpen !== null ? (
              <div className="flex items-center gap-1 text-right">
                <Clock className="w-3.5 h-3.5 text-blue-500" />
                <span className="text-xs font-medium text-blue-600">
                  {daysToOpen <= 0 ? 'Abre hoy' : `Abre en ${daysToOpen}d`}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-right">
                <Clock className={`w-3.5 h-3.5 ${urgColor}`} />
                <span className={`text-xs font-medium ${urgColor}`}>{urgLabel}</span>
              </div>
            )}

            {/* Difficulty */}
            <div className="flex items-center gap-1">
              <Sparkles className={`w-3 h-3 ${difficultyLabel.color}`} />
              <span className={`text-xs ${difficultyLabel.color}`}>
                Dificultad {difficultyLabel.text}
              </span>
            </div>

            {/* Success rate */}
            {grant.success_rate && (
              <span className="text-xs text-gray-500">
                {grant.success_rate.toFixed(0)}% aprobación hist.
              </span>
            )}

            {/* CTA */}
            <Link href={`/dashboard/subvenciones/${grant.id}`}>
              <Button size="sm" className="gap-1">
                Ver <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
