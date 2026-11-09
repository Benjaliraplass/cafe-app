import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { deleteLog, getLog, listRecipesForLog, saveRecipe, suggestRecipe } from '../lib/api'
import { photoUrl } from '../lib/supabase'
import { BREW_METHODS, type CoffeeLog, type Recipe, type RecipeData } from '../lib/types'
import { Button, Card, Chip, ErrorBox, Field, Input, Rating, Spinner } from '../components/ui'
import { formatDate } from './Home'

export function LogDetail() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [log, setLog] = useState<CoffeeLog | null | undefined>(undefined)
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [error, setError] = useState<string | null>(null)

  // Generador de recetas
  const [method, setMethod] = useState<string>('')
  const [equipment, setEquipment] = useState('')
  const [generating, setGenerating] = useState(false)
  const [draft, setDraft] = useState<RecipeData | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!id) return
    Promise.all([getLog(id), listRecipesForLog(id)])
      .then(([l, r]) => {
        setLog(l)
        setRecipes(r)
        if (l?.brew_method) setMethod(l.brew_method)
      })
      .catch((e) => setError(e.message))
  }, [id])

  async function generate() {
    if (!log || !method) return
    setError(null)
    setGenerating(true)
    setDraft(null)
    try {
      const c = log.coffee
      const data = await suggestRecipe({
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
        equipment: equipment.trim() || undefined,
      })
      setDraft(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo generar la receta')
    } finally {
      setGenerating(false)
    }
  }

  async function keepDraft() {
    if (!draft || !log || !user) return
    setSaving(true)
    try {
      await saveRecipe({ userId: user.id, coffeeId: log.coffee_id, logId: log.id, recipe: draft })
      setRecipes(await listRecipesForLog(log.id))
      setDraft(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar la receta')
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!log) return
    if (!confirm('¿Eliminar este registro? No se puede deshacer.')) return
    try {
      await deleteLog(log.id)
      navigate('/', { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo eliminar')
    }
  }

  if (log === undefined) {
    return (
      <div className="pt-8">
        <Spinner label="Cargando..." />
      </div>
    )
  }
  if (log === null) {
    return (
      <div className="pt-8">
        <p className="text-ink-2">No encontramos este registro.</p>
        <Link to="/" className="mt-4 inline-block text-accent">
          Volver a mis cafés
        </Link>
      </div>
    )
  }

  const c = log.coffee
  const url = photoUrl(log.photo_path)

  return (
    <div className="pt-4">
      <Link to="/" className="mb-4 inline-flex items-center gap-1 text-sm text-ink-2">
        <span aria-hidden>&larr;</span> Mis cafés
      </Link>

      {url && <img src={url} alt="" className="mb-5 aspect-[4/3] w-full rounded-3xl object-cover" />}

      <header className="mb-5">
        <p className="text-xs font-medium uppercase tracking-wide text-accent">{c?.roaster?.name ?? 'Tostador desconocido'}</p>
        <h1 className="font-display text-3xl leading-tight text-ink">{c?.name ?? 'Café'}</h1>
        <div className="mt-2 flex items-center gap-3">
          <Rating value={log.rating} />
          <span className="text-sm text-ink-3">{formatDate(log.consumed_at)}</span>
        </div>
      </header>

      <ErrorBox message={error} />

      <Card className="mb-4">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <Item k="Origen" v={[c?.origin_country, c?.region].filter(Boolean).join(', ')} />
          <Item k="Finca" v={c?.farm} />
          <Item k="Productor" v={c?.producer} />
          <Item k="Variedad" v={c?.variety} />
          <Item k="Proceso" v={c?.process} />
          <Item k="Altura" v={c?.altitude_masl ? `${c.altitude_masl} msnm` : null} />
          <Item k="Tueste" v={[c?.roast_level, c?.roast_profile].filter(Boolean).join(' · ')} />
          <Item k="Fecha de tueste" v={log.roast_date ? formatDate(log.roast_date) : null} />
          <Item k="Preparación" v={log.brew_method} />
          <Item k="Comprado en" v={log.bought_at} />
          <Item k="Precio" v={log.price_clp ? `$${log.price_clp.toLocaleString('es-CL')}` : null} />
        </dl>
        {c?.tasting_notes && c.tasting_notes.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {c.tasting_notes.map((n) => (
              <span key={n} className="rounded-full bg-bg-2 px-3 py-1 text-xs text-ink-2">
                {n}
              </span>
            ))}
          </div>
        )}
        {log.notes && <p className="mt-4 whitespace-pre-wrap text-sm text-ink-2">{log.notes}</p>}
      </Card>

      <section className="mb-6">
        <h2 className="mb-3 font-display text-2xl text-ink">Receta para este café</h2>
        <Card className="space-y-4">
          <Field label="Método">
            <div className="flex flex-wrap gap-2">
              {BREW_METHODS.map((m) => (
                <Chip key={m} active={method === m} onClick={() => setMethod(m)}>
                  {m}
                </Chip>
              ))}
            </div>
          </Field>
          <Field label="Mi equipo (opcional)" hint="Molino, balanza, máquina. Ayuda a afinar la molienda.">
            <Input value={equipment} onChange={(e) => setEquipment(e.target.value)} placeholder="Ej. Comandante C40, V60 plástico" />
          </Field>
          <Button className="w-full" onClick={generate} disabled={!method || generating}>
            {generating ? 'Diseñando receta...' : 'Generar receta con IA'}
          </Button>
          {generating && <Spinner label="Ajustando parámetros al origen y proceso..." />}
        </Card>

        {draft && (
          <div className="mt-4">
            <RecipeView r={draft} />
            <div className="mt-3 flex gap-3">
              <Button variant="ghost" className="flex-1" onClick={() => setDraft(null)} disabled={saving}>
                Descartar
              </Button>
              <Button className="flex-1" onClick={keepDraft} disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar receta'}
              </Button>
            </div>
          </div>
        )}
      </section>

      {recipes.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 font-display text-2xl text-ink">Recetas guardadas</h2>
          <div className="space-y-3">
            {recipes.map((r) => (
              <RecipeView
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
        </section>
      )}

      <div className="pb-6">
        <Button variant="danger" className="w-full" onClick={remove}>
          Eliminar registro
        </Button>
      </div>
    </div>
  )
}

function Item({ k, v }: { k: string; v: string | null | undefined }) {
  if (!v) return null
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-ink-3">{k}</dt>
      <dd className="text-ink">{v}</dd>
    </div>
  )
}

function RecipeView({ r, compact = false }: { r: RecipeData; compact?: boolean }) {
  const p = r.params
  const isEspresso = p.yield_g != null
  return (
    <Card>
      <p className="text-xs font-medium uppercase tracking-wide text-accent">{r.brew_method}</p>
      <h3 className="font-display text-xl text-ink">{r.title}</h3>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <Stat label="Dosis" value={`${p.dose_g} g`} />
        {isEspresso ? <Stat label="Salida" value={`${p.yield_g} g`} /> : <Stat label="Agua" value={p.water_g ? `${p.water_g} g` : '—'} />}
        <Stat label="Ratio" value={p.ratio} />
        <Stat label="Temp." value={`${p.water_temp_c} °C`} />
        <Stat label="Tiempo" value={p.total_time} />
        {isEspresso && p.pressure_bar != null ? <Stat label="Presión" value={`${p.pressure_bar} bar`} /> : <Stat label="Molienda" value={p.grind} small />}
      </div>
      {isEspresso && <p className="mt-2 text-sm text-ink-2">Molienda: {p.grind}</p>}
      {p.grind_reference && <p className="mt-1 text-sm text-ink-2">Referencia: {p.grind_reference}</p>}

      <ol className="mt-4 space-y-2">
        {r.steps.map((s, i) => (
          <li key={i} className="flex gap-3 text-sm">
            <span className="w-12 shrink-0 font-mono text-ink-3">{s.time}</span>
            <span className="text-ink">{s.action}</span>
          </li>
        ))}
      </ol>

      {!compact && (
        <>
          <p className="mt-4 text-sm text-ink-2">{r.rationale}</p>
          {r.rest_advice && <p className="mt-2 text-sm text-ink-2">Reposo: {r.rest_advice}</p>}
          {r.adjustments.length > 0 && (
            <ul className="mt-3 space-y-1 text-sm text-ink-2">
              {r.adjustments.map((a, i) => (
                <li key={i}>
                  <span className="text-ink">Si {a.if},</span> {a.then}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {compact && r.rationale && <p className="mt-3 whitespace-pre-wrap text-sm text-ink-2">{r.rationale}</p>}
    </Card>
  )
}

function Stat({ label, value, small = false }: { label: string; value: string; small?: boolean }) {
  return (
    <div className="rounded-xl bg-bg-2 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-ink-3">{label}</p>
      <p className={`${small ? 'text-xs' : 'text-base'} font-semibold text-ink`}>{value}</p>
    </div>
  )
}
