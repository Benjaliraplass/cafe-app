import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ErrorBox, Eyebrow, Field, Title } from '@/components/primitives'

/**
 * Destino del enlace "¿Olvidaste tu contraseña?". Supabase abre esta URL con una sesión de
 * recuperación; aquí se define la contraseña nueva y se entra directo. También sirve para cambiarla
 * desde Perfil con sesión normal.
 */
export function NewPassword() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  // supabase-js procesa el enlace (tokens en el hash) y emite PASSWORD_RECOVERY; damos unos ms de margen.
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
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la contraseña')
    } finally {
      setSaving(false)
    }
  }

  const noSession = ready && !loading && !user

  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-col px-6 pt-10 pb-10 safe-top">
      <header className="flex flex-col gap-1.5">
        <Eyebrow>Cuenta</Eyebrow>
        <Title>Nueva contraseña</Title>
      </header>
      {noSession ? (
        <div className="flex flex-col gap-4 pt-6">
          <p className="text-[15px] text-muted-foreground">
            El enlace venció o ya se usó. Pide uno nuevo desde "¿Olvidaste tu contraseña?" y ábrelo en este mismo teléfono.
          </p>
          <Button variant="outline" onClick={() => navigate('/', { replace: true })}>
            Volver
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4 pt-6">
          <Field label="Contraseña nueva" hint="Mínimo 6 caracteres">
            <Input type="password" autoComplete="new-password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </Field>
          <Field label="Repítela">
            <Input type="password" autoComplete="new-password" required minLength={6} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" />
          </Field>
          <ErrorBox message={error} />
          <Button type="submit" disabled={saving || !ready}>
            {saving ? 'Guardando...' : 'Guardar y entrar'}
          </Button>
        </form>
      )}
    </div>
  )
}
