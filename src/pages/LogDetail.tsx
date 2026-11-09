import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, Trash2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { deleteLog, getLog, listRecipesForLog, saveRecipe, suggestRecipe } from '@/lib/api'
import { photoUrl } from '@/lib/supabase'
import { BREW_METHODS, type CoffeeLog, type Recipe, type RecipeData } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Chip } from '@/components/ui/chip'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { ErrorBox, Eyebrow, Field, KeyValue, Photo, Rating, Spinner } from '@/components/primitives'
import { formatDate } from './Home'

export function LogDetail() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [log, setLog] = useState<CoffeeLog | null | undefined>(undefined)
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    Promise.all([getLog(id), listRecipesForLog(id)])
      .then(([l, r]) => {
        setLog(l)
        setRecipes(r)
      })
      .catch((e) => setError(e.message))
  }, [id])

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
        <Link to="/" className="mt-4 inline-block text-foreground underline underline-offset-4">
          Volver a mis cafés
        </Link>
      </div>
    )
  }

  return (
    <LogDetailView
      log={log}
      recipes={recipes}
      error={error}
      onGenerate={async (method, equipment) => {
        const c = log.coffee
        return suggestRecipe({
          coffee: {
            name: c?.name,
            roaster_name: c?.roaster?.name ?? null,
            origin_country: c?.origin_country,
            region: c?.region,
            farm: c?.farm,
            variety: c?.variety,
            process: c?.process,
            altitude_masl: c?.altitude_masl,
            roast_level: c?.roast_level,
            roast_profile: c?.roast_profile,
            tasting_notes: c?.tasting_notes,
            roast_date: log.roast_date,
          },
          brew_method: method,
          equipment: equipment || undefined,
        })
      }}
      onSaveRecipe={async (recipe) => {
        if (!user) return
        await saveRecipe({ userId: user.id, coffeeId: log.coffee_id, logId: log.id, recipe })
        setRecipes(await listRecipesForLog(log.id))
      }}
      onDelete={async () => {
        await deleteLog(log.id)
        navigate('/', { replace: true })
      }}
    />
  )
}

/** Vista presentacional (Figma 04 · Detalle). */
export function LogDetailView({
  log,
  recipes,
  error: outerError,
  onGenerate,
  onSaveRecipe,
  onDelete,
}: {
  log: CoffeeLog
  recipes: Recipe[]
  error: string | null
  onGenerate: (method: string, equipment: string) => Promise<RecipeData>
  onSaveRecipe: (recipe: RecipeData) => Promise<void>
  onDelete: () => Promise<void>
}) {
  // brew_method puede traer varios métodos separados por coma; el primero es el método por defecto de la receta
  const [method, setMethod] = useState<string>(log.brew_method?.split(',')[0]?.trim() ?? '')
  const [equipment, setEquipment] = useState('')
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
      setDraft(await onGenerate(method, equipment.trim()))
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
            <Link to="/" aria-label="Volver">
              <ChevronLeft strokeWidth={1.8} className="size-5" />
            </Link>
          </Button>
          <Button variant="secondary" size="icon" className="bg-background/55 backdrop-blur-md" onClick={remove} aria-label="Eliminar">
            <Trash2 strokeWidth={1.6} className="size-[18px]" />
          </Button>
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
          <KeyValue k="Finca" v={c?.farm} />
          <KeyValue k="Variedad" v={c?.variety} />
          <KeyValue k="Proceso" v={c?.process} />
          <KeyValue k="Productor" v={c?.producer} />
          <KeyValue k="Altura" v={c?.altitude_masl ? `${c.altitude_masl} msnm` : null} />
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
        {log.notes && <p className="text-[17px] italic leading-[1.35] text-muted-foreground">“{log.notes}”</p>}
      </section>

      <Separator />

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
        <Field label="Mi equipo (opcional)" hint="Molino, balanza, máquina. Ayuda a afinar la molienda.">
          <Input value={equipment} onChange={(e) => setEquipment(e.target.value)} placeholder="Ej. Comandante C40, V60 plástico" />
        </Field>
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
    </div>
  )
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function RecipeCard({ r, compact = false }: { r: RecipeData; compact?: boolean }) {
  const p = r.params
  const isEspresso = p.yield_g != null
  const stats: [string, string][] = [
    ['Dosis', `${p.dose_g} g`],
    isEspresso ? ['Salida', `${p.yield_g} g`] : ['Agua', p.water_g ? `${p.water_g} g` : '—'],
    ['Ratio', p.ratio],
    ['Temp.', `${p.water_temp_c} °C`],
    ['Tiempo', p.total_time],
    isEspresso && p.pressure_bar != null ? ['Presión', `${p.pressure_bar} bar`] : ['Molienda', p.grind],
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
      {isEspresso && <p className="text-sm text-muted-foreground">Molienda: {p.grind}</p>}
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
