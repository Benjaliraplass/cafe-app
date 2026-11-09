import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { Button, ErrorBox, Field, Input } from '../components/ui'

type Mode = 'login' | 'signup'

export function Login() {
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setLoading(true)
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        if (!data.session) {
          setInfo('Te enviamos un correo para confirmar la cuenta. Revisa tu bandeja y vuelve a entrar.')
        }
      }
    } catch (err) {
      setError(translate(err instanceof Error ? err.message : 'Error'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center px-6 py-12 safe-top safe-bottom">
      <div className="mb-10">
        <img src="/icons/icon-192.png" alt="" className="mb-5 h-16 w-16 rounded-2xl" />
        <h1 className="font-display text-4xl text-ink">Origen</h1>
        <p className="mt-2 text-ink-2">
          Tu diario de café de especialidad. Escanea la bolsa, guarda lo que tomaste y recibe recetas según el
          origen.
        </p>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <Field label="Correo">
          <Input
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@correo.com"
          />
        </Field>
        <Field label="Contraseña" hint={mode === 'signup' ? 'Mínimo 6 caracteres' : undefined}>
          <Input
            type="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </Field>
        <ErrorBox message={error} />
        {info && <p className="rounded-xl border border-ok/40 bg-ok/10 px-3.5 py-3 text-sm text-ok">{info}</p>}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Un momento...' : mode === 'login' ? 'Entrar' : 'Crear cuenta'}
        </Button>
      </form>

      <button
        type="button"
        className="mt-6 text-sm text-ink-2 underline-offset-4 hover:underline"
        onClick={() => {
          setMode(mode === 'login' ? 'signup' : 'login')
          setError(null)
          setInfo(null)
        }}
      >
        {mode === 'login' ? '¿No tienes cuenta? Crear una' : '¿Ya tienes cuenta? Entrar'}
      </button>
    </div>
  )
}

function translate(msg: string): string {
  const m = msg.toLowerCase()
  if (m.includes('invalid login credentials')) return 'Correo o contraseña incorrectos.'
  if (m.includes('email not confirmed')) return 'Confirma tu correo antes de entrar.'
  if (m.includes('user already registered')) return 'Ese correo ya tiene cuenta. Prueba entrar.'
  if (m.includes('password should be')) return 'La contraseña debe tener al menos 6 caracteres.'
  if (m.includes('rate limit')) return 'Demasiados intentos. Espera un momento.'
  return msg
}
