import Link from 'next/link'

export function AdminSectionCard({
  title,
  subtitle,
  href,
  children,
}: {
  title: string
  subtitle?: string
  href?: string
  children: React.ReactNode
}) {
  return (
    <section style={{
      background: 'var(--bg-2)',
      border: '1px solid var(--line)',
      borderRadius: 14,
      padding: '18px 20px',
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: 12,
        alignItems: 'baseline',
        marginBottom: 14,
        flexWrap: 'wrap',
      }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg)' }}>{title}</div>
          {subtitle && <div style={{ fontSize: 12.5, color: 'var(--fg-4)', marginTop: 3 }}>{subtitle}</div>}
        </div>
        {href && (
          <Link href={href} style={{ fontSize: 12.5, color: 'var(--accent-ink)', fontWeight: 500 }}>
            Ver todo
          </Link>
        )}
      </div>
      {children}
    </section>
  )
}

export function AdminStatCard({
  label,
  value,
  sub,
  color,
}: {
  label: string
  value: string | number
  sub?: string
  color?: string
}) {
  return (
    <div style={{
      padding: '20px 24px',
      background: 'var(--bg-2)',
      border: '1px solid var(--line)',
      borderRadius: 12,
    }}>
      <div style={{ fontSize: 11, color: 'var(--fg-4)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 600, color: color ?? 'var(--fg)', letterSpacing: '-0.02em' }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--fg-4)', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

export function AdminPill({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode
  tone?: 'neutral' | 'good' | 'warn' | 'danger' | 'accent' | 'info'
}) {
  const tones = {
    neutral: { bg: 'var(--bg)', border: 'var(--line)', color: 'var(--fg-3)' },
    good: { bg: 'var(--good-soft)', border: 'var(--good)', color: 'var(--good)' },
    warn: { bg: 'var(--accent-soft)', border: 'var(--accent-soft-2)', color: 'var(--accent-ink)' },
    danger: { bg: 'color-mix(in oklch, var(--danger) 10%, transparent)', border: 'color-mix(in oklch, var(--danger) 40%, white)', color: 'var(--danger)' },
    accent: { bg: 'var(--accent-soft)', border: 'var(--accent-soft-2)', color: 'var(--accent-ink)' },
    info: { bg: 'var(--info-soft)', border: 'color-mix(in oklch, var(--info) 35%, white)', color: 'var(--info)' },
  } as const

  const style = tones[tone]

  return (
    <span style={{
      fontSize: 11,
      padding: '3px 8px',
      borderRadius: 999,
      background: style.bg,
      border: `1px solid ${style.border}`,
      color: style.color,
      fontWeight: 500,
      whiteSpace: 'nowrap',
    }}>
      {children}
    </span>
  )
}

export function AdminEmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      padding: '28px 18px',
      textAlign: 'center',
      borderRadius: 12,
      border: '1px dashed var(--line-2)',
      color: 'var(--fg-3)',
      fontSize: 13,
      background: 'var(--bg)',
    }}>
      {children}
    </div>
  )
}
