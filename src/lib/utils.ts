import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatDate(date: string | null | undefined): string {
  if (!date) return '—'
  return new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(date))
}

export function daysUntil(date: string | null | undefined): number | null {
  if (!date) return null
  const diff = new Date(date).getTime() - new Date().getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

export function urgencyLabel(days: number | null): { label: string; color: string } {
  if (days === null) return { label: 'Sin fecha', color: 'text-gray-400' }
  if (days < 0) return { label: 'Cerrada', color: 'text-gray-400' }
  if (days <= 7) return { label: `${days}d`, color: 'text-red-500' }
  if (days <= 30) return { label: `${days}d`, color: 'text-amber-500' }
  return { label: `${days}d`, color: 'text-emerald-500' }
}

export function daysUntilOpen(date: string | null | undefined): number | null {
  if (!date) return null
  const diff = new Date(date).getTime() - new Date().getTime()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

export function scoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-600'
  if (score >= 60) return 'text-amber-600'
  return 'text-red-500'
}

export function scoreBarColor(score: number): string {
  if (score >= 80) return 'bg-emerald-500'
  if (score >= 60) return 'bg-amber-500'
  return 'bg-red-500'
}

export function grantTypeLabel(type: string): string {
  const map: Record<string, string> = {
    fondo_perdido: 'Fondo perdido',
    prestamo: 'Préstamo',
    mixto: 'Mixto',
    aval: 'Aval',
    bonificacion: 'Bonificación',
  }
  return map[type] || type
}

export function statusLabel(status: string): { label: string; color: string } {
  const map: Record<string, { label: string; color: string }> = {
    draft: { label: 'Borrador', color: 'bg-gray-100 text-gray-600' },
    review: { label: 'En revisión', color: 'bg-blue-100 text-blue-700' },
    submitted: { label: 'Enviada', color: 'bg-indigo-100 text-indigo-700' },
    subsanacion: { label: 'Subsanación', color: 'bg-amber-100 text-amber-700' },
    approved: { label: 'Aprobada', color: 'bg-emerald-100 text-emerald-700' },
    denied: { label: 'Denegada', color: 'bg-red-100 text-red-700' },
    pending_justification: { label: 'Pdte. Justificación', color: 'bg-purple-100 text-purple-700' },
    justified: { label: 'Justificada', color: 'bg-teal-100 text-teal-700' },
    closed: { label: 'Cerrada', color: 'bg-gray-100 text-gray-500' },
    abierta: { label: 'Abierta', color: 'bg-emerald-100 text-emerald-700' },
    proxima: { label: 'Próxima', color: 'bg-blue-100 text-blue-700' },
    cerrada: { label: 'Cerrada', color: 'bg-gray-100 text-gray-500' },
  }
  return map[status] || { label: status, color: 'bg-gray-100 text-gray-600' }
}
