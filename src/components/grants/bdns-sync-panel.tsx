'use client'

import { useState } from 'react'
import { RefreshCw, CheckCircle, AlertCircle, Database, Clock, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { SyncStats } from '@/lib/bdns-sync'

interface Props {
  lastSyncAt: string | null
  totalGrants: number
}

interface SyncResponse {
  ok: boolean
  stats?: SyncStats
  error?: string
}

interface EnrichStats {
  total: number
  enriched: number
  failed: number
  durationMs: number
}

interface EnrichResponse {
  ok: boolean
  stats?: EnrichStats
  error?: string
}

export default function BdnsSyncPanel({ lastSyncAt, totalGrants }: Props) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<SyncStats | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [enriching, setEnriching] = useState(false)
  const [enrichResult, setEnrichResult] = useState<EnrichStats | null>(null)
  const [enrichError, setEnrichError] = useState<string | null>(null)

  async function handleEnrich() {
    setEnriching(true)
    setEnrichResult(null)
    setEnrichError(null)
    try {
      const res = await fetch('/api/admin/enrich-grants', { method: 'POST' })
      const data = await res.json() as EnrichResponse
      if (!data.ok || !data.stats) {
        setEnrichError(data.error ?? 'Error desconocido')
      } else {
        setEnrichResult(data.stats)
      }
    } catch {
      setEnrichError('No se pudo conectar con el servidor')
    } finally {
      setEnriching(false)
    }
  }

  async function handleSync() {
    setLoading(true)
    setResult(null)
    setError(null)

    try {
      const res = await fetch('/api/admin/sync-bdns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maxPagesPerVpd: 5 }),
      })
      const data = await res.json() as SyncResponse

      if (!data.ok || !data.stats) {
        setError(data.error ?? 'Error desconocido durante la sincronización')
      } else {
        setResult(data.stats)
      }
    } catch {
      setError('No se pudo conectar con el servidor')
    } finally {
      setLoading(false)
    }
  }

  const lastSyncLabel = lastSyncAt
    ? new Date(lastSyncAt).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })
    : 'Nunca'

  return (
    <Card className="border-indigo-100 bg-indigo-50/40">
      <CardContent className="p-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Database className="w-4 h-4 text-indigo-500" />
              <span>
                <span className="font-semibold text-gray-900">{totalGrants.toLocaleString('es-ES')}</span>
                {' '}subvenciones BDNS en base de datos
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <Clock className="w-3.5 h-3.5" />
              Última sync: <span className="font-medium">{lastSyncLabel}</span>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleSync}
              disabled={loading || enriching}
              className="gap-2 border-indigo-200 hover:bg-indigo-100"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Sincronizando…' : 'Sincronizar ahora'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleEnrich}
              disabled={enriching || loading}
              className="gap-2 border-purple-200 hover:bg-purple-50 text-purple-700"
            >
              <Sparkles className={`w-3.5 h-3.5 ${enriching ? 'animate-pulse' : ''}`} />
              {enriching ? 'Enriqueciendo…' : 'Mejorar títulos (IA)'}
            </Button>
          </div>
        </div>

        {loading && (
          <p className="text-xs text-indigo-600 mt-3">
            Importando subvenciones de infosubvenciones.es — puede tardar entre 1 y 5 minutos…
          </p>
        )}

        {enriching && (
          <p className="text-xs text-purple-600 mt-3">
            Generando títulos y descripciones atractivos con IA — puede tardar varios minutos…
          </p>
        )}

        {result && (
          <div className="mt-3 p-3 bg-white rounded-lg border border-emerald-200 text-xs space-y-1.5">
            <div className="flex items-center gap-1.5 text-emerald-700 font-semibold">
              <CheckCircle className="w-4 h-4" />
              Sincronización completada
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-gray-600">
              <Stat label="Subvenciones importadas" value={result.totalGrantsUpserted} />
              <Stat label="Portales procesados" value={result.vpdsProcessed} />
              <Stat label="Páginas procesadas" value={result.totalPagesProcessed} />
              <Stat label="Duración" value={`${(result.durationMs / 1000).toFixed(0)}s`} />
            </div>
            {result.vpdsErrored > 0 && (
              <p className="text-amber-600">
                {result.vpdsErrored} portal(es) con error (VPDs no disponibles o no activos).
              </p>
            )}
            <p className="text-gray-400">Recarga la página para ver los nuevos resultados.</p>
          </div>
        )}

        {error && (
          <div className="mt-3 flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {enrichResult && (
          <div className="mt-3 p-3 bg-white rounded-lg border border-purple-200 text-xs space-y-1.5">
            <div className="flex items-center gap-1.5 text-purple-700 font-semibold">
              <CheckCircle className="w-4 h-4" />
              Títulos mejorados con IA
            </div>
            <div className="grid grid-cols-3 gap-2 text-gray-600">
              <Stat label="Procesadas" value={enrichResult.total} />
              <Stat label="Mejoradas" value={enrichResult.enriched} />
              <Stat label="Con error" value={enrichResult.failed} />
            </div>
            <p className="text-gray-400">Recarga la página para ver los títulos actualizados.</p>
          </div>
        )}

        {enrichError && (
          <div className="mt-3 flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {enrichError}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-gray-400">{label}</p>
      <p className="font-semibold text-gray-800">{typeof value === 'number' ? value.toLocaleString('es-ES') : value}</p>
    </div>
  )
}
