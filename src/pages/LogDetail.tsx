import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, Heart, Pencil, Share2, Trash2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { coffeeFromLog, deleteLog, getLog, getProfile, listRecipesForLog, saveRecipe, setFavorite, suggestRecipe, setLogPublic, updateEquipment } from '@/lib/api'
import { photoUrl } from '@/lib/supabase'
import { BREW_METHODS, type CoffeeLog, type Equipment, type Recipe, type RecipeData } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { absoluteUrl, shareLink } from '@/lib/share'
import { refParam, track } from '@/lib/analytics'
import { Card } from '@/components/ui/card'
import { Chip } from '@/components/ui/chip'
import { Separator } from '@/components/ui/separator'
import { ErrorBox, Eyebrow, KeyValue, Photo, Rating, Spinner } from '@/components/primitives'
import { EMPTY_SELECTION, EquipmentPicker, equipmentSelectionToText, espressoPatch, type EquipmentSelection } from '@/components/EquipmentPicker'
import { formatDate } from './Home'
import { cn } from '@/lib/utils'

export function LogDetail() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [log, setLog] = useState<CoffeeLog | null | undefined>(undefined)
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [equipment, setEquipment] = useState<Equipment | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id || !user) return
    Promise.all([getLog(id), listRecipesForLog(id), getProfile(user.id)])
      .then(([l, r, p]) => {
        setLog(l)
        setRecipes(r)
        setEquipment(p?.equipment ?? null)
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
    <LogDetailView
      key={log.id}
      log={log}
      recipes={recipes}
      equipment={equipment}
      error={error}
      onGenerate={async (method, equipment) => {
        const startedAt = Date.now()
        track('recipe_requested', { dripper: method, from: 'detail' })
        try {
          const r = await suggestRecipe({ coffee: coffeeFromLog(log), dripper: method, dose_g: method === 'Espresso' ? 18 : 15, servings: 1, equipment: equipment || undefined })
          track('recipe_generated', { dripper: method, from: 'detail', duration_ms: Date.now() - startedAt })
          return r
        } catch (e) {
          track('recipe_failed', { dripper: method, from: 'detail', reason: e instanceof Error ? e.message.slice(0, 80) : 'unknown' })
          throw e
        }
      }}
      onSaveEquipment={async (patch) => {
        if (!user) return
        const next = { ...(equipment ?? {}), ...patch }
        await updateEquipment(user.id, next)
        setEquipment(next)
      }}
      onSaveRecipe={async (recipe) => {
        if (!user) return
        await saveRecipe({ userId: user.id, coffeeId: log.coffee_id, logId: log.id, recipe })
        track('recipe_saved', { from: 'detail' })
        setRecipes(await listRecipesForLog(log.id))
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
  )
}

/** Vista presentacional (Figma 04 · Detalle). */
export function LogDetailView({
  log,
  recipes,
  equipment = null,
  error: outerError,
  onGenerate,
  onSaveRecipe,
  onDelete,
  onToggleFavorite,
  onTogglePublic,
  onSaveEquipment,
}: {
  log: CoffeeLog
  recipes: Recipe[]
  equipment?: Equipment | null
  error: string | null
  onGenerate: (method: string, equipment: string) => Promise<RecipeData>
  onSaveRecipe: (recipe: RecipeData) => Promise<void>
  onSaveEquipment?: (patch: Partial<Equipment>) => Promise<void>
  onDelete: () => Promise<void>
  onToggleFavorite?: () => Promise<void>
  onTogglePublic?: (value: boolean) => Promise<void>
}) {
  // brew_method puede traer varios métodos separados por coma; el primero es el método por defecto de la receta
  const [method, setMethod] = useState<string>(log.brew_method?.split(',')[0]?.trim() ?? '')
  const [equipmentSel, setEquipmentSel] = useState<EquipmentSelection>(EMPTY_SELECTION)
  const isEspresso = method === 'Espresso'
  const [generating, setGenerating] = useState(false)
  const [draft, setDraft] = useState<RecipeData | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const c = log.coffee
  const url = photoUrl(log.photo_path)
  const restDays = log.roast_date ? Math.max(0, Math.round((Date.now() - new Date(log.roast_date + 'T12:00:00').getTime()) / 86_400_000)) : null

  async function generate() {
    if (!method) return
    setError(null)
    setGenerating(true)
    setDraft(null)
    try {
      const patch = espressoPatch(equipmentSel)
      if (Object.keys(patch).length && onSaveEquipment) onSaveEquipment(patch).catch(() => {})
      setDraft(await onGenerate(method, equipmentSelectionToText(equipment, isEspresso, equipmentSel)))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo generar la receta')
    } finally {
      setGenerating(false)
    }
  }

  async function keepDraft() {
    if (!draft) return
    setSaving(true)
    try {
      await onSaveRecipe(draft)
      setDraft(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar la receta')
    } finally {
      setSaving(false)
    }
  }

  const [shared, setShared] = useState<'idle' | 'copied'>('idle')
  async function shareCoffee() {
    if (!c) return
    const res = await shareLink({
      title: `${c.name} · ${c.roaster?.name ?? 'Dripo'}`,
      text: [c.roaster?.name, c.name, c.origin_country, c.process].filter(Boolean).join(' · '),
      url: absoluteUrl(`/c/${c.id}${refParam(log.user_id)}`),
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
            <Rating value={log.rating} size="sm" />
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
          <KeyValue k="Precio" v={log.price_clp ? `$${log.price_clp.toLocaleString('es-CL')}` : null} />
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

      {/* Receta */}
      <section className="flex flex-col gap-4 px-6 pt-6 pb-10">
        <div className="flex items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <Eyebrow className="text-[10px]">Receta para este café</Eyebrow>
            <h2 className="text-2xl font-medium tracking-[-0.02em]">{method ? `${method}` : 'Elige un método'}</h2>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {BREW_METHODS.map((m) => (
            <Chip key={m} active={method === m} onClick={() => setMethod(m)}>
              {m}
            </Chip>
          ))}
        </div>
        <EquipmentPicker equipment={equipment} isEspresso={isEspresso} value={equipmentSel} onChange={setEquipmentSel} />
        <Button onClick={generate} disabled={!method || generating}>
          {generating ? 'Diseñando receta...' : 'Generar receta con IA'}
        </Button>
        {generating && <Spinner label="Ajustando parámetros al origen y proceso..." />}

        {draft && (
          <div className="flex flex-col gap-3">
            <RecipeCard r={draft} />
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setDraft(null)} disabled={saving}>
                Descartar
              </Button>
              <Button className="flex-1" onClick={keepDraft} disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar receta'}
              </Button>
            </div>
          </div>
        )}

        {recipes.length > 0 && (
          <div className="flex flex-col gap-3 pt-4">
            <Eyebrow className="text-[10px]">Recetas guardadas</Eyebrow>
            {recipes.map((r) => (
              <RecipeCard
                key={r.id}
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
            ))}
          </div>
        )}
      </section>

      <Separator />

      {/* Mi experiencia */}
      <section className="flex flex-col gap-5 px-6 pt-6 pb-10">
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
