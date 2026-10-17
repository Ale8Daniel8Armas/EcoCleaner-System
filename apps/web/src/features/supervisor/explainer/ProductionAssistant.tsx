import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { createClient } from '@supabase/supabase-js'
import { LiveAssistant } from './LiveAssistant'

// Cliente aislado: no sustituye la sesión ni el login del resto de la aplicación.
export function ProductionAssistant() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const client = useMemo(() => {
    const url = import.meta.env.VITE_SUPABASE_URL
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY
    return url && key && !key.startsWith('sb_secret_')
      ? createClient(url, key, {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
            storageKey: 'ecocleaner-assistant-auth',
          },
        })
      : null
  }, [])
  const request = useMemo<typeof fetch>(
    () => async (input, init) => {
      if (
        typeof input !== 'string' ||
        !['/api/app/state', '/api/app/question'].includes(input)
      )
        throw new Error('INVALID_ASSISTANT_ROUTE')
      const response = await fetch(input, {
        ...init,
        headers: {
          ...Object.fromEntries(new Headers(init?.headers)),
          Authorization: `Bearer ${token}`,
        },
      })
      if (response.status === 401 || response.status === 403) {
        setToken('')
        setError(
          'La sesión venció o tu cuenta no tiene acceso al asistente. Inicia sesión con una cuenta autorizada.',
        )
      }
      return response
    },
    [token],
  )
  const signIn = async (event: FormEvent) => {
    event.preventDefault()
    if (!client || busy) return
    setBusy(true)
    setError('')
    try {
      const { data, error: authError } = await client.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (
        authError ||
        !data.session ||
        data.user?.app_metadata.ecocleaner_role !== 'supervisor'
      ) {
        await client.auth.signOut({ scope: 'local' })
        setError(
          'No se pudo autorizar el acceso. Comprueba tus credenciales y que tu cuenta esté habilitada como supervisor.',
        )
      } else setToken(data.session.access_token)
    } catch {
      setError('No se pudo verificar tu acceso. Inténtalo de nuevo.')
    } finally {
      setPassword('')
      setBusy(false)
    }
  }
  if (token)
    return (
      <>
        <button
          className="supervisor-header-btn"
          type="button"
          onClick={() => {
            setToken('')
            void client?.auth.signOut({ scope: 'local' })
          }}
        >
          Cerrar acceso al asistente
        </button>
        <LiveAssistant request={request} />
      </>
    )
  return (
    <section
      className="card assistant-auth"
      aria-labelledby="assistant-access-title"
    >
      <h2 id="assistant-access-title">Acceso seguro al asistente</h2>
      <p>
        Inicia sesión con una cuenta autorizada de supervisor. Las respuestas
        requieren revisión humana.
      </p>
      {!client ? (
        <p role="status">
          El acceso todavía no está configurado. Contacta al administrador.
        </p>
      ) : (
        <form onSubmit={signIn}>
          <label>
            Correo
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label>
            Contraseña
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <button className="primary-button" type="submit" disabled={busy}>
            {busy ? 'Verificando acceso…' : 'Acceder al asistente'}
          </button>
        </form>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  )
}
