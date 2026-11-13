import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookOpen, Camera, ChevronRight, Sparkles } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { track } from '@/lib/analytics'
import { markOnboarded, updateEquipment } from '@/lib/api'
import { ALL_DRIPPERS, type Equipment } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { cn } from '@/lib/utils'
import { ErrorBox } from '@/components/primitives'

/**
 * Walkthrough de bienvenida: 3 pantallas, una vez por cuenta (profiles.onboarded_at).
 * Pantalla 2 pide lo único que mejora la app de inmediato: con qué preparas.
 * Termina en la acción principal (escanear). "Saltar" siempre visible.
 */
export function Onboarding() {
  const { user, profile, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [drippers, setDrippers] = useState<string[]>(profile?.equipment?.drippers ?? [])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function finish(how: 'completed' | 'skipped', step: number, to: string) {
    if (busy) return
    setBusy(true)
    setError(null)
    if (user) {
      const tasks: Promise<unknown>[] = [markOnboarded(user.id)]
      if (drippers.length) tasks.push(updateEquipment(user.id, { ...(profile?.equipment ?? {}), drippers } as Equipment))
      const [marked] = await Promise.allSettled(tasks)
      if (marked.status === 'rejected') {
        // Sin onboarded_at el Gate volvería a mostrar la bienvenida: mejor decirlo y dejar reintentar.
        setError('No pudimos guardar. Revisa tu conexión e intenta de nuevo.')
        setBusy(false)
        return
      }
      await refreshProfile()
    }
    track(how === 'completed' ? 'onboarding_completed' : 'onboarding_skipped', { step, drippers: drippers.length })
    // Cuenta creada por invitación (Lote 10): se cuenta como aceptada al terminar la bienvenida.
    if (profile?.invited_by || user?.user_metadata?.source === 'tostado') {
      track('invite_accepted', { source: profile?.invited_by ? 'invite' : 'tostado' })
    }
    navigate(to, { replace: true })
  }

  return (
    <OnboardingView
      drippers={drippers}
      onDrippers={setDrippers}
      busy={busy}
      error={error}
      onSkip={(step) => finish('skipped', step, '/')}
      onFinish={(to) => finish('completed', 3, to)}
    />
  )
}

const STEPS = [
  {
    icon: Camera,
    title: 'Escanea la etiqueta y listo',
    body: 'Foto a la bolsa. Leemos tostador, origen, proceso y notas, y llenamos la ficha por ti.',
  },
  {
    icon: BookOpen,
    title: 'Recetas a medida para tu café',
    body: 'Según el café, tu método y tu equipo. Dinos con qué preparas y partimos desde ahí.',
  },
  {
    icon: Sparkles,
    title: 'Cuéntanos cómo salió',
    body: 'Un toque después de preparar y la siguiente receta sale mejor.',
  },
]

export function OnboardingView({
  drippers,
  onDrippers,
  onSkip,
  onFinish,
  busy = false,
  error = null,
  initialStep = 0,
}: {
  drippers: string[]
  onDrippers: (d: string[]) => void
  busy?: boolean
  error?: string | null
  onSkip: (step: number) => void
  onFinish: (to: string) => void
  initialStep?: number
}) {
  const [step, setStep] = useState(initialStep)
  const s = STEPS[step]
  const Icon = s.icon
  const last = step === STEPS.length - 1

  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-col px-6 pb-[max(env(safe-area-inset-bottom),24px)] pt-4 safe-top">
      <div className="flex items-center justify-between">
        <div className="flex gap-1.5" aria-label={`Paso ${step + 1} de ${STEPS.length}`}>
          {STEPS.map((_, i) => (
            <span key={i} className={cn('h-1.5 rounded-full transition-all', i === step ? 'w-6 bg-foreground' : 'w-1.5 bg-border-strong')} />
          ))}
        </div>
        {!last && (
          <button type="button" disabled={busy} onClick={() => onSkip(step + 1)} className="py-2 pl-4 text-[13px] font-medium text-muted-foreground">
            Saltar
          </button>
        )}
      </div>

      <div className="flex flex-1 flex-col justify-center gap-7 py-10">
        <span className="flex size-20 items-center justify-center rounded-[28px] bg-card">
          <Icon className="size-9" strokeWidth={1.4} />
        </span>
        <div className="flex flex-col gap-3">
          <h1 className="text-[32px] font-medium leading-[1.05] tracking-tightest">{s.title}</h1>
          <p className="text-[17px] leading-snug text-muted-foreground">{s.body}</p>
        </div>

        {step === 1 && (
          <div className="flex flex-col gap-2.5">
            <span className="eyebrow text-[10px]">¿Con qué preparas?</span>
            <div className="flex flex-wrap gap-2">
              {ALL_DRIPPERS.map((d) => {
                const on = drippers.includes(d)
                return (
                  <Chip key={d} active={on} onClick={() => onDrippers(on ? drippers.filter((x) => x !== d) : [...drippers, d])}>
                    {d}
                  </Chip>
                )
              })}
            </div>
            <span className="text-xs text-tertiary">Puedes marcar varios o cambiarlo después en Perfil.</span>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {last ? (
          <>
            <ErrorBox message={error} />
            <Button size="lg" className="w-full" disabled={busy} onClick={() => onFinish('/scan')}>
              <Camera strokeWidth={1.7} /> Escanear mi primer café
            </Button>
            <button type="button" disabled={busy} onClick={() => onFinish('/')} className="py-2 text-[14px] font-medium text-muted-foreground">
              Mirar primero
            </button>
          </>
        ) : (
          <Button size="lg" className="w-full" onClick={() => setStep(step + 1)}>
            {step === 1 && drippers.length === 0 ? 'Después' : 'Continuar'} <ChevronRight strokeWidth={1.8} />
          </Button>
        )}
      </div>
    </div>
  )
}
