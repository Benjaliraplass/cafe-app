import { useState, type FormEvent } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ErrorBox, Field } from '@/components/primitives'

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
    <div className="mx-auto flex min-h-full w-full max-w-md flex-col">
      {/* Hero con fundido al fondo (Figma 01) */}
      <div className="relative h-[46vh] min-h-[340px] overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(135deg,#6b5c4d_0%,#2a2421_100%)]" />
        <div className="absolute inset-x-0 bottom-0 h-[70%] bg-[linear-gradient(to_bottom,transparent_0%,rgba(255,255,255,0.85)_55%,var(--background)_100%)]" />
        <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 px-6 pb-2">
          <h1 className="text-[46px] font-medium leading-none tracking-tightest">Dripo</h1>
          <p className="text-[15px] text-muted-foreground">Tu diario de café de especialidad</p>
        </div>
      </div>

      <form onSubmit={submit} className="flex flex-col gap-4 px-6 pt-4 pb-10">
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
        {info && <p className="rounded-xl bg-card px-4 py-3 text-sm text-muted-foreground">{info}</p>}
        <div className="flex flex-col gap-3 pt-1">
          <Button type="submit" disabled={loading}>
            {loading ? 'Un momento...' : mode === 'login' ? 'Entrar' : 'Crear cuenta'}
          </Button>
          <Button type="button" variant="outline" disabled title="Disponible pronto">
            Continuar con Google
          </Button>
        </div>
        <button
          type="button"
          className="pt-2 text-center text-[13px] text-muted-foreground"
          onClick={() => {
            setMode(mode === 'login' ? 'signup' : 'login')
            setError(null)
            setInfo(null)
          }}
        >
          {mode === 'login' ? (
            <>
              ¿No tienes cuenta? <span className="text-foreground">Crear una</span>
            </>
          ) : (
            <>
              ¿Ya tienes cuenta? <span className="text-foreground">Entrar</span>
            </>
          )}
        </button>
      </form>
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
