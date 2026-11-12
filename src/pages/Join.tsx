import { useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { track } from '@/lib/analytics'
import { getInviteInfo, joinBeta, type JoinStatus } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ErrorBox, Field } from '@/components/primitives'
import { Logo } from '@/components/Brand'

/**
 * /unete: entrada a la beta por invitación. Pública, un solo campo.
 * El usuario pone su correo y la app decide: cliente de Tostado Club o código con cupo -> correo
 * para crear la cuenta; si no -> lista de espera. Nunca se le pide elegir ni se le explica la regla.
 */
export function Join() {
  const [params] = useSearchParams()
  const ref = params.get('ref')?.trim().slice(0, 10) || null
  const [inviter, setInviter] = useState<string | null>(null)

  useEffect(() => {
    if (!ref) return
    getInviteInfo(ref).then((info) => {
      if (info?.has_quota && info.first_name) setInviter(info.first_name)
    })
  }, [ref])

  return (
    <JoinView
      inviter={inviter}
      onSubmit={async (email) => {
        const { status } = await joinBeta(email, ref)
        track('join_submitted', { status, via: inviter ? 'invite' : ref ? 'ref_sin_cupo' : 'directo' })
        return status
      }}
    />
  )
}

export function JoinView({ inviter, onSubmit }: { inviter: string | null; onSubmit: (email: string) => Promise<JoinStatus> }) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<JoinStatus | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      setStatus(await onSubmit(email.trim()))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pudimos procesar tu correo. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-col px-6 pb-10 pt-[calc(max(env(safe-area-inset-top),16px)+40px)]">
      <Logo className="h-9 w-auto self-start" />

      {status === null ? (
        <>
          <div className="flex flex-col gap-3 pt-12">
            {inviter && (
              <span className="w-fit rounded-full bg-card px-3 py-1 text-[13px] text-muted-foreground">{inviter} te invitó</span>
            )}
            <h1 className="text-[34px] font-medium leading-[1.05] tracking-tightest">Dripo es por invitación</h1>
            <p className="text-[15px] leading-relaxed text-muted-foreground">
              Tu diario de café de especialidad: escaneas la etiqueta, guardas lo que probaste y pides recetas a medida.
            </p>
          </div>
          <form onSubmit={submit} className="flex flex-col gap-4 pt-8">
            <Field label="Correo">
              <Input
                type="email"
                inputMode="email"
                autoComplete="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@correo.com"
              />
            </Field>
            <ErrorBox message={error} />
            <Button type="submit" disabled={loading || !email.trim()}>
              {loading ? 'Un momento...' : 'Continuar'}
            </Button>
          </form>
        </>
      ) : (
        <Result status={status} email={email.trim()} />
      )}

      <p className="pt-8 text-center text-[13px] text-muted-foreground">
        ¿Ya tienes cuenta?{' '}
        <Link to="/" className="text-foreground">
          Entrar
        </Link>
      </p>
    </div>
  )
}

function Result({ status, email }: { status: JoinStatus; email: string }) {
  const copy = {
    invited: {
      title: 'Revisa tu correo',
      body: `Te enviamos un enlace a ${email} para crear tu cuenta. Ábrelo desde este teléfono.`,
    },
    waitlist: {
      title: 'Estás en la lista de espera',
      body: 'Dripo está abriendo por rondas. Te avisamos a tu correo cuando se abra un cupo.',
    },
    exists: {
      title: 'Ese correo ya tiene cuenta',
      body: 'Entra con tu contraseña o con Google. Si no la recuerdas, pídela de nuevo desde "¿Olvidaste tu contraseña?".',
    },
  }[status]
  return (
    <div className="flex flex-col gap-3 pt-12">
      <h1 className="text-[34px] font-medium leading-[1.05] tracking-tightest">{copy.title}</h1>
      <p className="text-[15px] leading-relaxed text-muted-foreground">{copy.body}</p>
      {status === 'exists' && (
        <Button asChild className="mt-4 w-fit">
          <Link to="/">Entrar</Link>
        </Button>
      )}
    </div>
  )
}
