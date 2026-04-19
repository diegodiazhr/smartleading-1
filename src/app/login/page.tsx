'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [remember, setRemember] = useState(false)

  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setError('Email o contraseña incorrectos.')
      } else {
        window.location.href = '/dashboard'
      }
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      })
      if (error) {
        setError(error.message)
      } else {
        setSuccess(true)
      }
    }
    setLoading(false)
  }

  async function handleGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }

  async function handleGithub() {
    await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', minHeight: '100vh' }}>

      {/* ── Left: form ── */}
      <div style={{ padding: '32px 48px', display: 'flex', flexDirection: 'column' }}>
        {/* Top nav */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Link href="/" style={{
            display: 'inline-flex', alignItems: 'baseline',
            fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em',
            textDecoration: 'none', color: 'var(--fg)',
          }}>
            <span>Smart</span>
            <span style={{ color: 'var(--accent)' }}>Leading</span>
            <span style={{
              width: 5, height: 5, borderRadius: '50%',
              background: 'var(--accent)', marginLeft: 3,
              transform: 'translateY(-3px)', display: 'inline-block',
            }} />
          </Link>
          <Link href="/" style={{ fontSize: 13, color: 'var(--fg-3)', textDecoration: 'none' }}>
            ← Volver a la web
          </Link>
        </div>

        {/* Form centered */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {success ? (
            <div style={{ width: '100%', maxWidth: 400, textAlign: 'center', padding: '32px 0' }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%',
                background: 'var(--good-soft)', display: 'flex',
                alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="oklch(0.35 0.12 150)" strokeWidth="2"><path d="m5 12 4.5 4.5L20 6"/></svg>
              </div>
              <h2 style={{ fontSize: 22, fontWeight: 500, letterSpacing: '-0.02em', margin: '0 0 8px' }}>
                ¡Cuenta creada!
              </h2>
              <p style={{ color: 'var(--fg-3)', fontSize: 14 }}>
                Revisa tu email para confirmar la cuenta y acceder.
              </p>
              <button
                onClick={() => { setSuccess(false); setMode('login') }}
                style={{
                  marginTop: 20, padding: '10px 24px', borderRadius: 10,
                  border: '1px solid var(--line-2)', background: 'var(--bg)',
                  fontSize: 14, fontWeight: 500, cursor: 'pointer', color: 'var(--fg)',
                }}
              >
                Volver al login
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: 400 }}>
              <h1 style={{ fontSize: 36, fontWeight: 500, letterSpacing: '-0.025em', margin: 0, lineHeight: 1.05 }}>
                {mode === 'login' ? 'Bienvenido de vuelta.' : 'Crea tu cuenta.'}
              </h1>
              <p style={{ color: 'var(--fg-2)', marginTop: 12, fontSize: 15, lineHeight: 1.5 }}>
                {mode === 'login'
                  ? 'Inicia sesión para ver tus ayudas compatibles y los expedientes en curso.'
                  : 'Empieza a encontrar subvenciones para tu empresa hoy mismo.'}
              </p>

              {/* SSO buttons */}
              <button
                type="button"
                onClick={handleGoogle}
                style={{
                  width: '100%', padding: 11, borderRadius: 10, fontSize: 14, fontWeight: 500,
                  border: '1px solid var(--line-2)', background: 'var(--bg)', color: 'var(--fg)',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                  cursor: 'pointer', marginTop: 28,
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.15-4.53H2.18v2.84A10.99 10.99 0 0 0 12 23Z"/>
                  <path fill="#FBBC05" d="M5.85 14.1a6.61 6.61 0 0 1 0-4.2V7.07H2.18a11 11 0 0 0 0 9.86l3.67-2.83Z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1a10.99 10.99 0 0 0-9.82 6.07l3.67 2.84C6.71 7.3 9.14 5.38 12 5.38Z"/>
                </svg>
                Continuar con Google
              </button>
              <button
                type="button"
                onClick={handleGithub}
                style={{
                  width: '100%', padding: 11, borderRadius: 10, fontSize: 14, fontWeight: 500,
                  border: '1px solid var(--line-2)', background: 'var(--bg)', color: 'var(--fg)',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                  cursor: 'pointer', marginTop: 8,
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.58 2 12.25c0 4.5 2.87 8.31 6.84 9.66.5.09.68-.22.68-.49v-1.72c-2.78.61-3.37-1.35-3.37-1.35-.45-1.17-1.11-1.48-1.11-1.48-.91-.63.07-.62.07-.62 1 .07 1.53 1.05 1.53 1.05.89 1.56 2.34 1.11 2.91.85.09-.66.35-1.11.63-1.37-2.22-.26-4.56-1.14-4.56-5.06 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.28 2.75 1.05A9.3 9.3 0 0 1 12 6.8c.85 0 1.7.12 2.5.35 1.9-1.33 2.75-1.05 2.75-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.93-2.34 4.8-4.57 5.05.36.32.68.94.68 1.9v2.82c0 .27.18.59.69.49A10.02 10.02 0 0 0 22 12.25C22 6.58 17.52 2 12 2Z"/>
                </svg>
                Continuar con GitHub
              </button>
              <button
                type="button"
                style={{
                  width: '100%', padding: 11, borderRadius: 10, fontSize: 14, fontWeight: 500,
                  border: '1px solid var(--line-2)', background: 'var(--bg)', color: 'var(--fg)',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                  cursor: 'pointer', marginTop: 8,
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5l-8-3Z" opacity=".15"/>
                  <path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5l-8-3Z" fill="none" stroke="currentColor" strokeWidth="1.5"/>
                </svg>
                Cl@ve / DNIe
              </button>

              {/* Divider */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12,
                margin: '20px 0 16px', color: 'var(--fg-3)', fontSize: 12,
              }}>
                <span style={{ flex: 1, height: 1, background: 'var(--line)' }} />
                o con tu email
                <span style={{ flex: 1, height: 1, background: 'var(--line)' }} />
              </div>

              {/* Fields */}
              <div style={{ marginTop: 0 }}>
                <label style={{ fontSize: 13, color: 'var(--fg-2)', display: 'block', marginBottom: 6, fontWeight: 500 }}>
                  Email de trabajo
                </label>
                <input
                  type="email"
                  placeholder="tu@empresa.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoFocus
                  style={{
                    width: '100%', padding: '12px 14px',
                    border: '1px solid var(--line-2)', background: 'var(--bg)',
                    borderRadius: 10, fontSize: 15, fontFamily: 'inherit', color: 'var(--fg)',
                    outline: 'none',
                  }}
                  onFocus={e => {
                    e.target.style.borderColor = 'var(--accent)'
                    e.target.style.boxShadow = '0 0 0 4px var(--accent-soft)'
                  }}
                  onBlur={e => {
                    e.target.style.borderColor = 'var(--line-2)'
                    e.target.style.boxShadow = 'none'
                  }}
                />
              </div>
              <div style={{ marginTop: 16 }}>
                <label style={{ fontSize: 13, color: 'var(--fg-2)', display: 'block', marginBottom: 6, fontWeight: 500 }}>
                  Contraseña
                </label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={6}
                  style={{
                    width: '100%', padding: '12px 14px',
                    border: '1px solid var(--line-2)', background: 'var(--bg)',
                    borderRadius: 10, fontSize: 15, fontFamily: 'inherit', color: 'var(--fg)',
                    outline: 'none',
                  }}
                  onFocus={e => {
                    e.target.style.borderColor = 'var(--accent)'
                    e.target.style.boxShadow = '0 0 0 4px var(--accent-soft)'
                  }}
                  onBlur={e => {
                    e.target.style.borderColor = 'var(--line-2)'
                    e.target.style.boxShadow = 'none'
                  }}
                />
              </div>

              {/* Remember + forgot */}
              {mode === 'login' && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, fontSize: 13 }}>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--fg-2)', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={remember}
                      onChange={e => setRemember(e.target.checked)}
                      style={{ accentColor: 'var(--accent)' }}
                    />
                    Recuérdame 30 días
                  </label>
                  <a href="#" style={{ color: 'var(--fg-2)', textDecoration: 'none', fontSize: 13 }}>
                    ¿Olvidaste la contraseña?
                  </a>
                </div>
              )}

              {/* Error */}
              {error && (
                <div style={{
                  marginTop: 12, padding: '10px 14px', borderRadius: 8,
                  background: 'oklch(0.95 0.05 25)', border: '1px solid oklch(0.9 0.08 25)',
                  color: 'var(--danger)', fontSize: 13,
                }}>
                  {error}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%', padding: 12, borderRadius: 10,
                  fontSize: 15, fontWeight: 500,
                  border: '1px solid var(--accent)',
                  background: loading ? 'oklch(0.82 0.1 55)' : 'var(--accent)',
                  color: 'var(--accent-ink)',
                  marginTop: 20,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  transition: 'all .15s ease',
                }}
              >
                {loading ? 'Cargando…' : mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
                {!loading && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14"/><path d="m13 5 7 7-7 7"/>
                  </svg>
                )}
              </button>

              {/* Footer link */}
              <p style={{ fontSize: 13, color: 'var(--fg-3)', textAlign: 'center', marginTop: 24 }}>
                {mode === 'login' ? (
                  <>
                    ¿Aún no tienes cuenta?{' '}
                    <button
                      type="button"
                      onClick={() => { setMode('signup'); setError(null) }}
                      style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 13, fontWeight: 500, padding: 0 }}
                    >
                      Crear cuenta →
                    </button>
                  </>
                ) : (
                  <>
                    ¿Ya tienes cuenta?{' '}
                    <button
                      type="button"
                      onClick={() => { setMode('login'); setError(null) }}
                      style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 13, fontWeight: 500, padding: 0 }}
                    >
                      Iniciar sesión →
                    </button>
                  </>
                )}
              </p>
            </form>
          )}
        </div>

        {/* Mini footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--fg-4)', paddingTop: 24, fontFamily: 'var(--font-geist-mono), monospace' }}>
          <span>© 2026 SmartLeading SL</span>
          <span>ISO 27001 · ENS Alto</span>
        </div>
      </div>

      {/* ── Right: decorative panel ── */}
      <div style={{
        position: 'relative', overflow: 'hidden',
        background: 'var(--bg-2)', borderLeft: '1px solid var(--line)',
        padding: 48, display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      }}>
        {/* Grid overlay */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          backgroundImage: 'linear-gradient(to right, var(--line) 1px, transparent 1px), linear-gradient(to bottom, var(--line) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          maskImage: 'radial-gradient(ellipse 80% 70% at 70% 40%, #000 30%, transparent 90%)',
          opacity: 0.6,
        }} />
        {/* Amber glow */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'radial-gradient(ellipse 55% 45% at 70% 35%, var(--accent-soft) 0%, transparent 70%)',
        }} />

        {/* Testimonial */}
        <div style={{ position: 'relative', zIndex: 1, maxWidth: 440 }}>
          <span style={{ fontSize: 11, color: 'var(--fg-3)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Lo que dicen nuestros clientes
          </span>
          <p style={{ fontSize: 22, lineHeight: 1.35, letterSpacing: '-0.01em', fontWeight: 400, color: 'var(--fg)', margin: '16px 0 0' }}>
            "En tres meses SmartLeading nos identificó{' '}
            <span style={{ background: 'var(--accent-soft-2)', padding: '2px 4px', borderRadius: 4 }}>
              € 187.000
            </span>
            {' '}en ayudas que ni sabíamos que existían. Presentaron cuatro expedientes. Cobramos tres."
          </p>
          <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              background: 'var(--accent-soft-2)', color: 'var(--accent-ink)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 600, fontSize: 14,
            }}>MR</div>
            <div style={{ fontSize: 13 }}>
              <div style={{ fontWeight: 500 }}>Marta R.</div>
              <div style={{ color: 'var(--fg-3)', marginTop: 2, fontSize: 12 }}>CFO · Grupo Vértice · 42 empleados</div>
            </div>
          </div>
        </div>

        {/* Stats card */}
        <div style={{
          position: 'relative', zIndex: 1,
          border: '1px solid var(--line)', background: 'var(--bg)',
          borderRadius: 14, padding: 20,
          boxShadow: 'var(--shadow-lg)', maxWidth: 440,
        }}>
          <span style={{ fontSize: 11, color: 'var(--fg-3)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            En tu dashboard te esperan
          </span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginTop: 14 }}>
            {[
              { value: '€ 7,1M', label: 'ayudas compatibles' },
              { value: '50', label: 'convocatorias' },
              { value: '3', label: 'alta afinidad', accent: true },
            ].map(({ value, label, accent }) => (
              <div key={label}>
                <div style={{
                  fontSize: 22, fontWeight: 500, letterSpacing: '-0.02em',
                  fontFamily: 'var(--font-geist-mono), monospace',
                  color: accent ? 'var(--accent)' : 'var(--fg)',
                }}>{value}</div>
                <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 2 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
