import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { BookOpen, ChevronLeft, ChevronRight, Heart, Pencil, Share2, Trash2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { deleteLog, getLog, listRecipesForLog, saveRecipeFeedback, setFavorite, setLogPublic } from '@/lib/api'
import { photoUrl } from '@/lib/supabase'
import { formatPrice, isPendingLog, type CoffeeLog, type Recipe, type RecipeData } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { absoluteUrl, shareLink } from '@/lib/share'
import { refParam, track } from '@/lib/analytics'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { ErrorBox, Eyebrow, KeyValue, Photo, Rating, Spinner } from '@/components/primitives'
import { RecipeFeedbackBlock } from '@/components/RecipeFeedback'
import type { BrewSignal } from '@/lib/brewFeedback'
import { formatDate } from './Home'
import { cn } from '@/lib/utils'
import { InviteUnlockSheet } from '@/components/Invites'

export function LogDetail() {
  const { id } = useParams<{ id: string }>()
  const { user, profile } = useAuth()
  const navigate = useNavigate()

  const [log, setLog] = useState<CoffeeLog | null | undefined>(undefined)
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id || !user) return
    Promise.all([getLog(id), listRecipesForLog(id)])
      .then(([l, r]) => {
        setLog(l)
        setRecipes(r)
      })
      .catch((e) => setError(e.message))
  }, [id, user])

  if (log === undefined) {
    return (
      <div className="px-6 pt-8">
        <Spinner label="Cargando..." />
      </div>
    )
  }
  if (log === null) {
    return (
      <div className="px-6 pt-8">
        <p className="text-muted-foreground">No encontramos este registro.</p>
        <Link to="/logs" className="mt-4 inline-block text-foreground underline underline-offset-4">
          Volver a mis cafés
        </Link>
      </div>
    )
  }

  return (
    <>
    {/* Hoja "Desbloqueaste N invitaciones": aparece aquí porque el primer café guardado aterriza en su detalle. */}
    <InviteUnlockSheet />
    <LogDetailView
      key={log.id}
      log={log}
      recipes={recipes}
      error={error}
      inviteCode={profile?.invite_code}
      onSaveFeedback={async (recipeId, signal, note, ruleId, suggestion) => {
        if (!user) return
        const fb = await saveRecipeFeedback({ userId: user.id, recipeId, signal, note, ruleId, suggestion })
        track('recipe_feedback_given', { signal, rule: ruleId ?? 'none' })
        setRecipes((rs) => rs.map((r) => (r.id === recipeId ? { ...r, feedback: [fb, ...(r.feedback ?? [])] } : r)))
      }}
      onDelete={async () => {
        await deleteLog(log.id)
        track('log_deleted')
        navigate('/logs', { replace: true })
      }}
      onToggleFavorite={async () => {
        const next = !log.is_favorite
        setLog({ ...log, is_favorite: next })
        try {
          await setFavorite(log.id, next)
        } catch (e) {
          setLog({ ...log, is_favorite: !next })
          setError(e instanceof Error ? e.message : 'No se pudo actualizar')
        }
      }}
      onTogglePublic={async (value) => {
        setLog({ ...log, is_public: value })
        try {
          await setLogPublic(log.id, value)
          track('log_made_public', { value })
        } catch (e) {
          setLog({ ...log, is_public: !value })
          setError(e instanceof Error ? e.message : 'No se pudo actualizar')
        }
      }}
    />
    </>
  )
}

/** Vista presentacional (Figma 04 · Detalle). */
export function LogDetailView({
  log,
  recipes,
  error: outerError,
  onDelete,
  onToggleFavorite,
  onTogglePublic,
  onSaveFeedback,
  inviteCode,
}: {
  log: CoffeeLog
  /** Código del dueño para el ?ref= del enlace compartido. */
  inviteCode?: string
  recipes: Recipe[]
  error: string | null
  onSaveFeedback?: (recipeId: string, signal: BrewSignal, note: string | null, ruleId: string | null, suggestion: string) => Promise<void>
  onDelete: () => Promise<void>
  onToggleFavorite?: () => Promise<void>
  onTogglePublic?: (value: boolean) => Promise<void>
}) {
  const [error, setError] = useState<string | null>(null)
  const c = log.coffee
  const url = photoUrl(log.photo_path)
  const pending = isPendingLog(log)
  const restDays = log.roast_date ? Math.max(0, Math.round((Date.now() - new Date(log.roast_date + 'T12:00:00').getTime()) / 86_400_000)) : null

  const [shared, setShared] = useState<'idle' | 'copied'>('idle')
  async function shareCoffee() {
    if (!c) return
    const res = await shareLink({
      title: `${c.name} · ${c.roaster?.name ?? 'Dripo'}`,
      text: [c.roaster?.name, c.name, c.origin_country, c.process].filter(Boolean).join(' · '),
      url: absoluteUrl(`/c/${c.id}${refParam(inviteCode)}`),
    })
    if (res !== 'failed') track('share_clicked', { type: 'log', result: res })
    if (res === 'copied') {
      setShared('copied')
      setTimeout(() => setShared('idle'), 1800)
    }
  }

  async function remove() {
    if (!confirm('¿Eliminar este registro? No se puede deshacer.')) return
    try {
      await onDelete()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo eliminar')
    }
  }

  return (
    <div className="-mt-[env(safe-area-inset-top)]">
      {/* Hero */}
      <div className="relative h-[440px] overflow-hidden">
        <Photo src={url} className="absolute inset-0" />
        <div className="absolute inset-x-0 bottom-0 h-[70%] bg-[linear-gradient(to_bottom,transparent_0%,rgba(255,255,255,0.85)_55%,var(--background)_100%)]" />
        <div className="absolute inset-x-0 top-0 flex items-center justify-between px-4 pt-[calc(env(safe-area-inset-top)+10px)]">
          <Button asChild variant="secondary" size="icon" className="bg-background/55 backdrop-blur-md">
            <Link to="/logs" aria-label="Volver">
              <ChevronLeft strokeWidth={1.8} className="size-5" />
            </Link>
          </Button>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="icon"
              className="bg-background/55 backdrop-blur-md"
              onClick={onToggleFavorite}
              aria-label={log.is_favorite ? 'Quitar de favoritos' : 'Marcar favorito'}
              aria-pressed={log.is_favorite}
            >
              <Heart strokeWidth={1.6} className={cn('size-[18px]', log.is_favorite && 'fill-foreground')} />
            </Button>
            <Button asChild variant="secondary" size="icon" className="bg-background/55 backdrop-blur-md">
              <Link to={`/log/${log.id}/edit`} aria-label="Editar">
                <Pencil strokeWidth={1.6} className="size-[18px]" />
              </Link>
            </Button>
            <Button variant="secondary" size="icon" className="bg-background/55 backdrop-blur-md" onClick={remove} aria-label="Eliminar">
              <Trash2 strokeWidth={1.6} className="size-[18px]" />
            </Button>
          </div>
        </div>
        <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 px-6 pb-1">
          <Eyebrow className="text-muted-foreground">{c?.roaster?.name ?? 'Tostador desconocido'}</Eyebrow>
          <h1 className="text-[44px] font-medium leading-none tracking-tightest">{c?.name ?? 'Café'}</h1>
          <div className="flex items-center gap-2.5 text-[13px] text-muted-foreground">
            {pending ? <span className="rounded-full bg-background/70 px-2 py-0.5 text-[11px] font-medium backdrop-blur-sm">Por probar</span> : <Rating value={log.rating} size="sm" />}
            <span className="text-tertiary">·</span>
            <span>{formatDate(log.consumed_at)}</span>
            {log.brew_method && (
              <>
                <span className="text-tertiary">·</span>
                <span>{log.brew_method}</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="px-6 pt-4">
        <ErrorBox message={outerError ?? error} />
      </div>

      {/* Ficha */}
      <section className="flex flex-col gap-5 px-6 pt-4 pb-6">
        <div className="grid grid-cols-2 gap-x-3 gap-y-3.5">
          <KeyValue k="Origen" v={[c?.origin_country, c?.region].filter(Boolean).join(', ')} />
          <KeyValue k="Tostador" v={c?.roaster ? [c.roaster.name, c.roaster.country].filter(Boolean).join(' · ') : null} />
          <KeyValue k="Finca" v={c?.farm} />
          <KeyValue k="Variedad" v={c?.variety} />
          <KeyValue k="Proceso" v={c?.process} />
          <KeyValue k="Productor" v={c?.producer} />
          <KeyValue k="Altura" v={c?.altitude_masl ? `${c.altitude_masl} msnm` : null} />
          <KeyValue k="Puntaje SCA" v={c?.sca_score ? `${c.sca_score} pts` : null} />
          <KeyValue k="Tueste" v={[c?.roast_profile && cap(c.roast_profile), log.roast_date && formatDate(log.roast_date)].filter(Boolean).join(' · ')} />
          <KeyValue k="Reposo" v={restDays != null ? `${restDays} días` : null} />
          <KeyValue k="Comprado en" v={log.bought_at} />
          <KeyValue k="Precio" v={formatPrice(log.price_clp, log.currency)} />
        </div>
        {c?.tasting_notes && c.tasting_notes.length > 0 && (
          <div className="flex flex-col gap-2.5">
            <Eyebrow className="text-[10px]">Notas de cata</Eyebrow>
            <div className="flex flex-wrap gap-2">
              {c.tasting_notes.map((n) => (
                <span key={n} className="rounded-full bg-muted px-3 py-1.5 text-xs">
                  {n}
                </span>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Recetas: el wizard de Recetas con este café ya elegido (método → cantidad → afinemos) */}
      <section className="flex flex-col gap-4 px-6 pt-6 pb-10">
        <div className="flex flex-col gap-1">
          <Eyebrow className="text-[10px]">Recetas</Eyebrow>
          <h2 className="text-2xl font-medium tracking-[-0.02em]">Prepara este café</h2>
        </div>
        <Button asChild>
          <Link to={`/recipes?log=${log.id}`}>
            <BookOpen strokeWidth={1.7} /> Pedir receta a medida
          </Link>
        </Button>
        {pending && recipes.length > 0 && (
          <p className="text-sm text-muted-foreground">Cuando lo prepares, vuelve y cuéntanos cómo salió.</p>
        )}

        {recipes.length > 0 && (
          <div className="flex flex-col gap-3 pt-4">
            <Eyebrow className="text-[10px]">Recetas guardadas</Eyebrow>
            {recipes.map((r) => (
              <div key={r.id} className="flex flex-col gap-2">
                <RecipeCard
                  r={{
                    title: r.title ?? r.brew_method,
                    brew_method: r.brew_method,
                    params: r.params,
                    steps: r.steps,
                    rationale: r.rationale ?? '',
                    adjustments: [],
                    rest_advice: null,
                  }}
                  compact
                />
                <RecipeFeedbackBlock
                  method={r.brew_method}
                  feedback={r.feedback ?? []}
                  onSave={onSaveFeedback ? (signal, note, ruleId, suggestion) => onSaveFeedback(r.id, signal, note, ruleId, suggestion) : undefined}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      <Separator />

      {/* Mi experiencia */}
      <section className="flex flex-col gap-5 px-6 pt-6 pb-10">
        {pending && (
          <Link to={`/log/${log.id}/edit#experiencia`} className="flex items-center gap-4 rounded-[20px] border border-dashed border-border-strong px-4 py-4 transition-colors active:bg-card">
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-[15px] font-medium">¿Ya lo probaste?</span>
              <span className="text-sm text-muted-foreground">Puntaje, método y notas. Un minuto.</span>
            </span>
            <ChevronRight className="size-5 shrink-0 text-tertiary" strokeWidth={1.7} />
          </Link>
        )}
        {log.notes && <p className="text-[17px] italic leading-[1.35] text-muted-foreground">“{log.notes}”</p>}

        {c && (
          <div className="flex flex-col gap-3 rounded-[20px] bg-card p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-[15px] font-medium">Compartir mi registro</span>
                <span className="text-xs text-muted-foreground">Tu puntaje y tus notas aparecen con tu nombre en la ficha pública de este café.</span>
              </div>
              <Switch checked={log.is_public} onCheckedChange={(v) => onTogglePublic?.(v)} disabled={!onTogglePublic} aria-label="Compartir mi registro" />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={shareCoffee}>
                <Share2 className="size-4" strokeWidth={1.8} /> {shared === 'copied' ? 'Enlace copiado' : 'Compartir café'}
              </Button>
              <Button asChild variant="secondary" size="sm" className="flex-1">
                <Link to={`/c/${c.id}`}>Ver ficha pública</Link>
              </Button>
            </div>
          </div>
        )}
      </section>

    </div>
  )
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function RecipeCard({ r, compact = false }: { r: RecipeData; compact?: boolean }) {
  const p = r.params
  const isEspresso = p.yield_g != null
  // La molienda puede venir larga ("Media, un punto más gruesa..."): en el cuadro va solo la primera idea.
  const grindShort = p.grind.split(/[,;:(]/)[0].trim() || p.grind
  const grindLong = isEspresso || grindShort !== p.grind.trim()
  const stats: [string, string][] = [
    ['Dosis', `${p.dose_g} g`],
    isEspresso ? ['Salida', `${p.yield_g} g`] : ['Agua', p.water_g ? `${p.water_g} g` : '—'],
    ['Ratio', p.ratio],
    ['Temp.', `${p.water_temp_c} °C`],
    ['Tiempo', p.total_time],
    isEspresso && p.pressure_bar != null ? ['Presión', `${p.pressure_bar} bar`] : ['Molienda', grindShort],
  ]
  return (
    <Card className="flex flex-col gap-4 p-[18px]">
      <div className="flex flex-col gap-0.5">
        <Eyebrow className="text-[10px]">{r.brew_method}</Eyebrow>
        <h3 className="text-xl font-medium tracking-[-0.02em]">{r.title}</h3>
      </div>
      <div className="grid grid-cols-3 gap-2.5">
        {stats.map(([k, v]) => (
          <div key={k} className="flex flex-col gap-0.5 rounded-xl bg-muted px-3 py-3">
            <span className="text-[10px] font-medium uppercase tracking-eyebrow text-tertiary">{k}</span>
            <span className={cnSize(v)}>{v}</span>
          </div>
        ))}
      </div>
      {grindLong && <p className="text-sm text-muted-foreground">Molienda: {p.grind}</p>}
      {p.grind_reference && <p className="text-sm text-muted-foreground">Referencia: {p.grind_reference}</p>}
      <ol className="flex flex-col gap-2.5">
        {r.steps.map((s, i) => (
          <li key={i} className="flex gap-3.5 text-sm">
            <span className="w-10 shrink-0 font-medium text-tertiary tabular-nums">{s.time}</span>
            <span className="leading-[1.4]">{s.action}</span>
          </li>
        ))}
      </ol>
      {!compact && (
        <>
          <p className="text-[13px] leading-[1.45] text-muted-foreground">{r.rationale}</p>
          {r.rest_advice && <p className="text-[13px] leading-[1.45] text-muted-foreground">Reposo: {r.rest_advice}</p>}
          {r.adjustments.length > 0 && (
            <ul className="flex flex-col gap-1 text-[13px] text-muted-foreground">
              {r.adjustments.map((a, i) => (
                <li key={i}>
                  <span className="text-foreground">Si {a.if},</span> {a.then}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {compact && r.rationale && <p className="whitespace-pre-wrap text-[13px] leading-[1.45] text-muted-foreground">{r.rationale}</p>}
    </Card>
  )
}

function cnSize(v: string) {
  return v.length > 9 ? 'text-sm font-medium' : 'text-lg font-medium tracking-[-0.01em]'
}
