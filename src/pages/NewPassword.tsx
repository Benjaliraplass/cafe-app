import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { EmailOtpType } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { updateProfile } from '@/lib/api'
import { translateAuthError } from '@/lib/authErrors'
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
      let userId = user?.id ?? null
      if (link.tokenHash && link.type && !user) {
        const { data, error } = await supabase.auth.verifyOtp({ token_hash: link.tokenHash, type: link.type })
        if (error || !data.user) {
          setExpired(true)
          return
        }
        userId = data.user.id
      }
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
          <p className="pt-1 text-[15px] text-muted-foreground">Con tu contraseña entras la próxima vez. También puedes usar Google con este mismo correo.</p>
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
          <Button type="submit" disabled={saving || (!ready && !link.tokenHash)}>
            {saving ? 'Guardando...' : 'Guardar y entrar'}
          </Button>
        </form>
      )}
    </div>
  )
}
