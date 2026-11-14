import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { EmailOtpType } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { updateProfile } from '@/lib/api'
import { translateAuthError } from '@/lib/authErrors'
import { GOOGLE_CLIENT_ID, createNonce, emailFromIdToken, loadGoogleIdentity } from '@/lib/google'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ErrorBox, Eyebrow, Field, Title } from '@/components/primitives'

/**
 * Destino del correo de invitación y de "¿Olvidaste tu contraseña?". También sirve para cambiarla
 * desde Perfil con sesión normal.
 *
 * Dos formas de llegar:
 * - Enlace con `?token_hash=...&type=invite|recovery` (plantillas actuales): el token se valida recién al
 *   tocar "Guardar y entrar". Así los escáneres de correo (Outlook, antivirus) que abren el enlace antes
 *   que la persona no lo gastan.
 * - Enlace clásico de Supabase (tokens en el hash): supabase-js crea la sesión al cargar.
 *
 * En una invitación pide además el nombre (si no, el perfil queda con el prefijo del correo) y marca
 * `password_set` para que el Gate no deje entrar a un invitado sin contraseña.
 */
export function NewPassword() {
  const { user, loading, refreshProfile } = useAuth()
  const navigate = useNavigate()
  // supabase-js limpia la URL al procesar el hash: se lee una vez.
  const [link] = useState(() => {
    const q = new URLSearchParams(window.location.search)
    const raw = window.location.hash + window.location.search
    return {
      tokenHash: q.get('token_hash'),
      type: (q.get('type') as EmailOtpType | null) ?? null,
      email: q.get('email'),
      invite: /type=invite/.test(raw),
    }
  })
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expired, setExpired] = useState(false)
  const [ready, setReady] = useState(false)
  // Google en la invitación: botón de Google Identity Services (como en Login). El callback se crea una
  // vez, así que lee el nombre y la sesión vigentes desde refs.
  const gisRef = useRef<HTMLDivElement>(null)
  const [gisReady, setGisReady] = useState(false)
  const [googleBusy, setGoogleBusy] = useState(false)
  const nameRef = useRef(name)
  nameRef.current = name
  const userIdRef = useRef<string | null>(user?.id ?? null)
  userIdRef.current = user?.id ?? null
  const userEmailRef = useRef<string | null>(user?.email ?? null)
  userEmailRef.current = user?.email ?? null
  // Cuenta del enlace ya aceptada en esta pantalla (el token es de un solo uso).
  const acceptedRef = useRef<{ id: string; email: string | null } | null>(null)

  /**
   * Acepta el enlace del correo (token_hash) y devuelve la cuenta resultante. Se hace SIEMPRE que el enlace
   * traiga token, aunque el navegador tenga otra sesión abierta: si no, la contraseña o Google se aplicaban a
   * esa otra cuenta y la invitación quedaba sin aceptar. Sin token (cambio desde Perfil o reenvío del Gate),
   * usa la sesión actual. Devuelve null si el enlace venció o ya se usó.
   */
  async function acceptLink(): Promise<{ id: string; email: string | null } | null> {
    if (acceptedRef.current) return acceptedRef.current
    if (link.tokenHash && link.type) {
      const { data, error } = await supabase.auth.verifyOtp({ token_hash: link.tokenHash, type: link.type })
      if (error || !data.user) return null
      acceptedRef.current = { id: data.user.id, email: data.user.email ?? null }
      return acceptedRef.current
    }
    if (userIdRef.current) return { id: userIdRef.current, email: userEmailRef.current }
    return null
  }
  const acceptLinkRef = useRef(acceptLink)
  acceptLinkRef.current = acceptLink

  useEffect(() => {
    if (!link.invite || !GOOGLE_CLIENT_ID) return
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
            setGoogleBusy(true)
            try {
              // 1) Aceptar la invitación: confirma el correo. Sin esto Supabase no une Google a la cuenta.
              const invited = await acceptLinkRef.current()
              if (!invited) {
                setExpired(true)
                return
              }
              const invitedEmail = invited.email
              // 2) Solo si el Google es del mismo correo: si no, Supabase entraría a OTRA cuenta de Dripo con ese
              //    correo (si existe) y la invitación quedaría a medias. La invitación ya quedó aceptada.
              const googleEmail = emailFromIdToken(credential)
              if (!invitedEmail || !googleEmail || googleEmail !== invitedEmail.toLowerCase()) {
                setError('Esa cuenta de Google es de otro correo. Crea una contraseña para este y listo.')
                return
              }
              // 3) Entrar con Google: mismo correo (ya verificado), Supabase une la identidad a la cuenta.
              const { data, error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: credential, nonce })
              if (error || !data.user) {
                setError('No pudimos entrar con Google. Crea una contraseña para este correo.')
                return
              }
              const meta = data.user.user_metadata ?? {}
              const display = nameRef.current.trim() || (meta.full_name as string | undefined) || (meta.name as string | undefined) || ''
              if (display) await updateProfile(data.user.id, { display_name: display }).catch(() => undefined)
              await refreshProfile()
              navigate('/', { replace: true })
            } finally {
              setGoogleBusy(false)
            }
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
        // Sin GIS: queda solo la contraseña.
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Con el enlace clásico, supabase-js procesa el hash y emite la sesión; damos unos ms de margen.
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 400)
    return () => clearTimeout(t)
  }, [])

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.')
      return
    }
    setSaving(true)
    try {
      const account = await acceptLink()
      if (!account) {
        setExpired(true)
        return
      }
      const userId = account.id
      const { error } = await supabase.auth.updateUser({ password, data: { password_set: true } })
      if (error) throw error
      if (link.invite && userId && name.trim()) {
        await updateProfile(userId, { display_name: name.trim() }).catch(() => undefined)
        await refreshProfile()
      }
      navigate('/', { replace: true })
    } catch (err) {
      const msg = translateAuthError(err instanceof Error ? err.message : '')
      if (msg === 'El enlace venció o ya se usó.') setExpired(true)
      else setError(msg)
    } finally {
      setSaving(false)
    }
  }

  const noSession = expired || (ready && !loading && !user && !link.tokenHash)
  const email = user?.email ?? link.email ?? ''

  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-col px-6 pb-10 pt-[calc(max(env(safe-area-inset-top),16px)+24px)]">
      <header className="flex flex-col gap-1.5">
        <Eyebrow>{link.invite ? 'Bienvenido a Dripo' : 'Cuenta'}</Eyebrow>
        <Title>{link.invite ? 'Crea tu cuenta' : 'Nueva contraseña'}</Title>
        {link.invite && !noSession && (
          <p className="pt-1 text-[15px] text-muted-foreground">Crea una contraseña o entra con tu cuenta de Google de este mismo correo.</p>
        )}
      </header>
      {noSession ? (
        <div className="flex flex-col gap-4 pt-6">
          {link.invite ? (
            <>
              <p className="text-[15px] leading-relaxed text-muted-foreground">
                El enlace venció o ya se usó. Pide uno nuevo con tu correo y ábrelo apenas te llegue.
              </p>
              <Button asChild>
                <Link to="/unete" replace>
                  Pedir un enlace nuevo
                </Link>
              </Button>
            </>
          ) : (
            <>
              <p className="text-[15px] leading-relaxed text-muted-foreground">
                El enlace venció o ya se usó. Pide uno nuevo desde "¿Olvidaste tu contraseña?" en la pantalla de entrada de Dripo, en tu teléfono.
              </p>
              <Button variant="outline" onClick={() => navigate('/', { replace: true })}>
                Volver
              </Button>
            </>
          )}
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4 pt-6">
          {/* Usuario oculto: iCloud Keychain y Google guardan la contraseña asociada al correo. */}
          {email && <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />}
          {link.invite && (
            <Field label="¿Cómo te llamas?">
              <Input autoComplete="given-name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre" maxLength={40} />
            </Field>
          )}
          <Field label="Contraseña nueva" hint="Mínimo 6 caracteres">
            <Input type="password" autoComplete="new-password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </Field>
          <Field label="Repítela">
            <Input type="password" autoComplete="new-password" required minLength={6} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" />
          </Field>
          <ErrorBox message={error} />
          <Button type="submit" disabled={saving || googleBusy || (!ready && !link.tokenHash)}>
            {saving ? 'Guardando...' : 'Guardar y entrar'}
          </Button>
          {link.invite && (
            <>
              <div className={gisReady ? 'flex items-center gap-3 pt-1 text-[13px] text-tertiary' : 'hidden'}>
                <span className="h-px flex-1 bg-border" />o<span className="h-px flex-1 bg-border" />
              </div>
              {/* Botón de Google (lo dibuja GIS). Mientras entra, un aviso en su lugar. */}
              <div ref={gisRef} className={gisReady && !googleBusy ? 'flex h-11 justify-center overflow-hidden' : 'hidden'} />
              {googleBusy && <p className="text-center text-sm text-muted-foreground">Entrando con Google...</p>}
            </>
          )}
        </form>
      )}
    </div>
  )
}
