import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { GOOGLE_CLIENT_ID, createNonce, emailFromIdToken, loadGoogleIdentity } from '@/lib/google'
import { joinBeta } from '@/lib/api'
import { track } from '@/lib/analytics'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ErrorBox, Field } from '@/components/primitives'
import { Logo } from '@/components/Brand'

type Mode = 'login' | 'reset'

export function Login() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [googleLoading, setGoogleLoading] = useState(false)
  // Botón de Google Identity Services (GIS). Si no se puede montar, usamos el flujo OAuth de Supabase.
  const gisRef = useRef<HTMLDivElement>(null)
  const [gisReady, setGisReady] = useState(false)

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return
    let cancelled = false
    ;(async () => {
      try {
        const [id, { nonce, hashedNonce }] = await Promise.all([loadGoogleIdentity(), createNonce()])
        if (cancelled || !gisRef.current) return
        id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          nonce: hashedNonce,
          use_fedcm_for_prompt: true,
          itp_support: true,
          callback: async ({ credential }) => {
            setError(null)
            setGoogleLoading(true)
            const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: credential, nonce })
            if (error && translate(error.message) === NEEDS_INVITE) {
              // Cliente de Tostado Club que llegó al login y no a /unete: el registro está cerrado, así que se
              // pide el ingreso con su correo de Google y, si queda invitado, se entra con Google de inmediato
              // (Supabase une Google a la cuenta invitada del mismo correo).
              const googleEmail = emailFromIdToken(credential)
              const status = googleEmail ? await joinBeta(googleEmail, null).then((r) => r.status).catch(() => null) : null
              track('join_submitted', { status: status ?? 'error', via: 'login_google' })
              if (status === 'invited') {
                const retry = await supabase.auth.signInWithIdToken({ provider: 'google', token: credential, nonce })
                if (!retry.error) return
                setInfo('Listo: te mandamos un correo para crear tu cuenta. Ábrelo y toca "Aceptar invitación".')
              } else if (status === 'waitlist') {
                setInfo('Ese correo no está entre los clientes de Tostado Club. Quedaste en la lista de espera y te avisamos cuando se abra un cupo.')
              } else {
                setError(NEEDS_INVITE)
              }
              setGoogleLoading(false)
            } else if (error) {
              setError(translate(error.message))
              setGoogleLoading(false)
            }
            // Con éxito, useAuth detecta la sesión y el Gate muestra la app.
          },
        })
        id.renderButton(gisRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'pill',
          logo_alignment: 'center',
          locale: 'es',
          width: Math.min(gisRef.current.clientWidth || 360, 400),
        })
        setGisReady(true)
      } catch {
        // Sin GIS: queda el botón de respaldo (OAuth vía Supabase).
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  async function signInWithGoogle() {
    setError(null)
    setInfo(null)
    setGoogleLoading(true)
    try {
      // Vuelve a la misma URL (producción o localhost). Supabase la redirige a través de su callback.
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin, queryParams: { prompt: 'select_account' } },
      })
      if (error) throw error
      // Si no hay error, el navegador está navegando a Google; dejamos el estado de carga.
    } catch (err) {
      setError(translate(err instanceof Error ? err.message : 'Error'))
      setGoogleLoading(false)
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setLoading(true)
    try {
      if (mode === 'reset') {
        // Muchos clientes nuevos llegan aquí sin cuenta: primero se pasa por /unete. Si ya tiene cuenta, el
        // enlace de recuperación; si estaba en la lista, el correo para crearla; si no, lista de espera.
        const { status } = await joinBeta(email.trim(), null)
        track('join_submitted', { status, via: 'login_reset' })
        if (status === 'exists') {
          const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/nueva-contrasena` })
          if (error) throw error
          setInfo('Te enviamos un enlace para crear una contraseña nueva. Si no aparece en unos minutos, revisa Spam o Promociones.')
        } else if (status === 'invited') {
          setInfo('Aún no tenías cuenta: te mandamos un correo para crearla. Ábrelo y toca "Aceptar invitación". Si no aparece, revisa Spam o Promociones.')
        } else {
          setInfo('Ese correo no tiene cuenta ni está entre los clientes de Tostado Club. Quedaste en la lista de espera y te avisamos cuando se abra un cupo.')
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
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
        {/* Foto del hero (public/hero.jpg). Si no existe, queda el degradado de respaldo. */}
        <img
          src="/hero.jpg"
          alt=""
          className="absolute inset-0 size-full object-cover object-center"
          onError={(e) => {
            e.currentTarget.style.display = 'none'
          }}
        />
        <div className="absolute inset-x-0 -bottom-px h-[70%] bg-[linear-gradient(to_bottom,transparent_0%,rgba(255,255,255,0.85)_55%,var(--background)_100%)]" />
        <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 px-6 pb-2">
          <h1 className="leading-none"><Logo className="h-[52px] w-auto" /></h1>
          <p className="text-[15px] text-muted-foreground">Tu diario de café de especialidad</p>
        </div>
      </div>

      <form onSubmit={submit} className="flex flex-col gap-4 px-6 pt-4 pb-10">
        {mode === 'login' && (
          <Link to="/unete" className="flex items-center justify-between gap-3 rounded-2xl bg-card px-4 py-3.5 transition-colors active:bg-muted">
            <span className="flex flex-col">
              <span className="text-[15px] font-medium">¿Primera vez en Dripo?</span>
              <span className="text-[13px] text-muted-foreground">Crea tu cuenta con el correo de tus compras en Tostado Club.</span>
            </span>
            <span className="shrink-0 text-[13px] font-medium underline underline-offset-4">Crear cuenta</span>
          </Link>
        )}
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
        {mode !== 'reset' && (
          <Field label="Contraseña">
            <Input
              type="password"
              autoComplete="current-password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </Field>
        )}
        {mode === 'reset' && <p className="text-sm text-muted-foreground">Te mandamos un enlace para crear una contraseña nueva.</p>}
        {error === NEEDS_INVITE ? (
          <p className="rounded-xl bg-card px-4 py-3 text-sm text-muted-foreground">
            Ese correo todavía no tiene invitación.{' '}
            <Link to="/unete" className="text-foreground underline underline-offset-4">
              Pide la tuya
            </Link>
            .
          </p>
        ) : error === WRONG_LOGIN ? (
          <div className="flex flex-col gap-2 rounded-xl bg-card px-4 py-3 text-sm text-muted-foreground">
            <span className="text-destructive">Correo o contraseña incorrectos.</span>
            <span>
              ¿Es tu primera vez? Todavía no tienes contraseña:{' '}
              <button type="button" className="text-foreground underline underline-offset-4" onClick={() => navigate('/unete', { state: { email } })}>
                crea tu cuenta
              </button>
              .
            </span>
          </div>
        ) : (
          <ErrorBox message={error} />
        )}
        {info && <p className="rounded-xl bg-card px-4 py-3 text-sm text-muted-foreground">{info}</p>}
        <div className="flex flex-col gap-3 pt-1">
          <Button type="submit" disabled={loading}>
            {loading ? 'Un momento...' : mode === 'login' ? 'Entrar' : 'Enviar enlace'}
          </Button>
          {mode === 'login' && (
            <button
              type="button"
              className="text-center text-[13px] text-muted-foreground"
              onClick={() => {
                setMode('reset')
                setError(null)
                setInfo(null)
              }}
            >
              ¿Olvidaste tu contraseña?
            </button>
          )}
          {/* Botón GIS (Google lo dibuja). Mientras no esté listo, o si falla, se ve el de respaldo. */}
          <div ref={gisRef} className={gisReady && !googleLoading && mode !== 'reset' ? 'flex h-11 justify-center overflow-hidden' : 'hidden'} />
          {mode !== 'reset' && (!gisReady || googleLoading) && (
            <Button type="button" variant="outline" onClick={signInWithGoogle} disabled={googleLoading || loading}>
              <GoogleMark />
              {googleLoading ? 'Entrando...' : 'Continuar con Google'}
            </Button>
          )}
        </div>
        {mode === 'login' ? (
          <p className="pt-2 text-center text-[13px] text-muted-foreground">
            ¿No tienes cuenta?{' '}
            <Link to="/unete" className="text-foreground">
              Pide tu invitación
            </Link>
          </p>
        ) : (
          <button
            type="button"
            className="pt-2 text-center text-[13px] text-foreground"
            onClick={() => {
              setMode('login')
              setError(null)
              setInfo(null)
            }}
          >
            Volver a entrar
          </button>
        )}
        <p className="pt-4 text-center text-xs text-muted-foreground">
          Al continuar aceptas la{' '}
          <Link to="/privacidad" className="underline underline-offset-4">
            política de privacidad
          </Link>
          .
        </p>
      </form>
    </div>
  )
}

/** Logotipo "G" de Google en sus colores oficiales (lineamientos de marca para botones de inicio de sesión). */
function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" width={18} height={18} aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  )
}

/** Marcador: el correo no tiene cuenta y el registro está cerrado (Dripo es por invitación). */
const NEEDS_INVITE = '__needs_invite__'
/** Marcador: credenciales incorrectas (casi siempre alguien nuevo que aún no tiene cuenta). */
const WRONG_LOGIN = '__wrong_login__'

function translate(msg: string): string {
  const m = msg.toLowerCase()
  if (m.includes('signups not allowed') || (m.includes('signup') && m.includes('disabled'))) return NEEDS_INVITE
  if (m.includes('provider is not enabled') || m.includes('unsupported provider')) return 'El acceso con Google aún no está habilitado.'
  if (m.includes('invalid login credentials')) return WRONG_LOGIN
  if (m.includes('email not confirmed')) return 'Confirma tu correo antes de entrar.'
  if (m.includes('user already registered')) return 'Ese correo ya tiene cuenta. Prueba entrar.'
  if (m.includes('password should be')) return 'La contraseña debe tener al menos 6 caracteres.'
  if (m.includes('rate limit')) return 'Demasiados intentos. Espera un momento.'
  return msg
}
