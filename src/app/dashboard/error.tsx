'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[Dashboard error]', error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
      <AlertTriangle className="w-12 h-12 text-amber-500 mb-4" />
      <h2 className="text-xl font-semibold text-gray-900 mb-2">Algo ha ido mal</h2>
      <p className="text-gray-500 text-sm mb-6 max-w-md">
        Hubo un error al cargar el dashboard. Inténtalo de nuevo.
      </p>
      <Button onClick={reset}>Reintentar</Button>
    </div>
  )
}
