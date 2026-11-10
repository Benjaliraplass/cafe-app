import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, Minus, Plus, RotateCcw } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { coffeeFromLog, getProfile, getTasteProfile, listMyLogs, listMyRecipes, saveRecipe, suggestRecipe, type SavedRecipe, type SuggestRecipeInput } from '@/lib/api'
import { tasteSummary, tasteToPreferences, type TasteProfile } from '@/lib/taste'
import { photoUrl } from '@/lib/supabase'
import { METHOD_FAMILIES, TASTE_PREFERENCES, equipmentToText, type CoffeeLog, type Equipment, type MethodFamily, type RecipeData } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorBox, Eyebrow, Field, Photo, Spinner, Title } from '@/components/primitives'
import { RecipeCard } from '@/pages/LogDetail'
import { cn } from '@/lib/utils'

type Step = 1 | 2 | 3 | 4 | 'result'

/** Ratio café:agua por familia, usado para traducir gramos a agua y personas. */
const RATIO_BY_FAMILY: Record<MethodFamily, number> = { conico: 16, flat: 16, inmersion: 15, espresso: 2 }
const ML_PER_PERSON = 200

export function Recipes() {
  const { user } = useAuth()
  const [logs, setLogs] = useState<CoffeeLog[] | null>(null)
  const [saved, setSaved] = useState<SavedRecipe[] | null>(null)
  const [equipment, setEquipment] = useState<Equipment | null | undefined>(undefined)
  const [taste, setTaste] = useState<TasteProfile | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    Promise.all([listMyLogs(user.id), listMyRecipes(user.id), getProfile(user.id), getTasteProfile(user.id).catch(() => null)])
      .then(([l, r, p, t]) => {
        setLogs(l)
        setSaved(r)
        setEquipment(p?.equipment ?? null)
        setTaste(t)
      })
      .catch((e) => setError(e.message))
  }, [user])

  if (equipment === undefined && !error) {
    return (
      <div className="px-6 pt-8">
        <Spinner label="Cargando..." />
      </div>
    )
  }

  return (
    <RecipesView
      logs={logs}
      saved={saved}
      equipment={equipment ?? null}
      taste={taste}
      error={error}
      onGenerate={(input) => suggestRecipe(input)}
      onSave={async (recipe, log) => {
        if (!user) return
        await saveRecipe({ userId: user.id, coffeeId: log?.coffee_id ?? null, logId: log?.id ?? null, recipe })
        setSaved(await listMyRecipes(user.id))
      }}
    />
  )
}

/** Vista presentacional: wizard de 4 pasos + recetario. */
export function RecipesView({
  logs,
  saved,
  equipment: profileEquipment,
  taste = null,
  error: outerError,
  onGenerate,
  onSave,
}: {
  logs: CoffeeLog[] | null
  saved: SavedRecipe[] | null
  taste?: TasteProfile | null
  equipment: Equipment | null
  error: string | null
  onGenerate: (input: SuggestRecipeInput) => Promise<RecipeData>
  onSave: (recipe: RecipeData, log: CoffeeLog | null) => Promise<void>
}) {
  const [step, setStep] = useState<Step>(1)
  const [log, setLog] = useState<CoffeeLog | null>(null)
  const [otherCoffee, setOtherCoffee] = useState('')
  const [useOther, setUseOther] = useState(false)
  const [family, setFamily] = useState<MethodFamily | null>(null)
  const [dripper, setDripper] = useState<string | null>(null)
  // Cantidad: la dosis de café manda; las personas (200 ml c/u) se derivan con el ratio de la familia.
  const [dose, setDose] = useState('15')
  const [equipment, setEquipment] = useState(() => equipmentToText(profileEquipment))
  const [showAllMethods, setShowAllMethods] = useState(!profileEquipment?.drippers?.length)
  const myDrippers = profileEquipment?.drippers ?? []
  const [pref, setPref] = useState<string | null>(null)
  const [useTaste, setUseTaste] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [recipe, setRecipe] = useState<RecipeData | null>(null)
  const [saving, setSaving] = useState(false)
  const [savedOk, setSavedOk] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fam = useMemo(() => METHOD_FAMILIES.find((f) => f.id === family) ?? null, [family])
  const isEspresso = family === 'espresso'
  const ratio = family ? RATIO_BY_FAMILY[family] : 16
  const doseNum = Number(dose) || 0
  const waterMl = isEspresso ? null : Math.round(doseNum * ratio)
  const people = waterMl ? Math.max(1, Math.round(waterMl / ML_PER_PERSON)) : null

  // Al elegir familia, propone una dosis típica si el usuario no la tocó.
  function chooseFamily(id: MethodFamily) {
    setFamily(id)
    if (dose === '15' || dose === '18') setDose(id === 'espresso' ? '18' : '15')
  }
  function setPeople(n: number) {
    const p = Math.min(8, Math.max(1, n))
    // Dosis necesaria para p personas con el ratio de la familia, redondeada a 0,5 g
    setDose(String(Math.round(((p * ML_PER_PERSON) / ratio) * 2) / 2))
  }
  function bumpDose(delta: number) {
    setDose(String(Math.max(1, Math.round((doseNum + delta) * 2) / 2)))
  }

  const canNext: Record<Exclude<Step, 'result'>, boolean> = {
    1: !!log || (useOther && otherCoffee.trim().length > 2),
    2: !!family && !!dripper,
    3: doseNum > 0,
    4: true,
  }

  async function generate() {
    if (!dripper || !family) return
    setError(null)
    setGenerating(true)
    setRecipe(null)
    setSavedOk(false)
    setStep('result')
    try {
      const input: SuggestRecipeInput = {
        coffee: log ? coffeeFromLog(log) : null,
        coffee_description: !log && useOther ? otherCoffee.trim() : undefined,
        method_family: family,
        dripper,
        servings: !isEspresso && people ? people : undefined,
        dose_g: doseNum,
        equipment: equipment.trim() || undefined,
        preferences: [pref, useTaste ? tasteToPreferences(taste) : null].filter(Boolean).join('. ') || undefined,
      }
      setRecipe(await onGenerate(input))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo generar la receta')
    } finally {
      setGenerating(false)
    }
  }

  async function save() {
    if (!recipe) return
    setSaving(true)
    try {
      await onSave(recipe, log)
      setSavedOk(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  function reset() {
    setStep(1)
    setRecipe(null)
    setSavedOk(false)
    setError(null)
  }

  const stepIndex = step === 'result' ? 4 : step

  return (
    <div>
      <header className="flex flex-col gap-1.5 px-6 pt-4">
        <Eyebrow>Recetas</Eyebrow>
        <div className="flex items-end justify-between gap-4">
          <Title className="text-[38px]">{step === 'result' ? 'Tu receta' : 'A medida'}</Title>
          {step !== 'result' && <span className="shrink-0 pb-1 text-[13px] whitespace-nowrap text-muted-foreground">Paso {stepIndex} de 4</span>}
        </div>
      </header>

      {/* Progreso */}
      <div className="flex gap-1.5 px-6 pt-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className={cn('h-1 flex-1 rounded-full', i <= stepIndex ? 'bg-foreground' : 'bg-muted')} />
        ))}
      </div>

      <div className="px-6 pt-4">
        <ErrorBox message={outerError ?? error} />
      </div>

      {/* Paso 1: café */}
      {step === 1 && (
        <section className="flex flex-col gap-4 px-6 pt-4">
          <StepTitle n={1} title="¿Con qué café?" hint="Elige uno de los que escaneaste o describe otro." />
          {!logs && <div className="flex flex-col gap-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-[72px]" />)}</div>}
          {logs && logs.length === 0 && (
            <p className="rounded-2xl bg-card p-4 text-sm text-muted-foreground">
              Todavía no tienes cafés escaneados.{' '}
              <Link to="/scan" className="text-foreground underline underline-offset-4">
                Escanea uno
              </Link>{' '}
              o describe el café abajo.
            </p>
          )}
          {logs && logs.length > 0 && (
            <ul className="flex flex-col">
              {logs.slice(0, 8).map((l, i) => {
                const active = log?.id === l.id
                return (
                  <li key={l.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setLog(active ? null : l)
                        setUseOther(false)
                      }}
                      className={cn('flex w-full items-center gap-3.5 rounded-2xl px-2 py-3 text-left transition-colors', active && 'bg-card')}
                    >
                      <Photo src={photoUrl(l.photo_path)} className="size-12 shrink-0 rounded-xl" />
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="eyebrow truncate text-[10px]">{l.coffee?.roaster?.name ?? 'Tostador desconocido'}</span>
                        <span className="truncate text-[16px] font-medium">{l.coffee?.name ?? 'Café'}</span>
                        <span className="truncate text-xs text-muted-foreground">
                          {[l.coffee?.origin_country, l.coffee?.process].filter(Boolean).join(' · ')}
                        </span>
                      </div>
                      <span className={cn('size-5 shrink-0 rounded-full border', active ? 'border-foreground bg-foreground' : 'border-border-strong')} />
                    </button>
                    {i < Math.min(logs.length, 8) - 1 && <Separator className="mx-2 w-auto" />}
                  </li>
                )
              })}
            </ul>
          )}
          <div className="flex flex-col gap-2">
            <Chip
              active={useOther}
              onClick={() => {
                setUseOther(!useOther)
                if (!useOther) setLog(null)
              }}
              className="self-start"
            >
              Otro café
            </Chip>
            {useOther && (
              <Input
                autoFocus
                value={otherCoffee}
                onChange={(e) => setOtherCoffee(e.target.value)}
                placeholder="Ej. Etiopía natural, tueste claro, notas florales"
              />
            )}
          </div>
        </section>
      )}

      {/* Paso 2: método */}
      {step === 2 && (
        <section className="flex flex-col gap-4 px-6 pt-4">
          <StepTitle n={2} title="¿Qué método?" hint={myDrippers.length ? 'Tus métodos del perfil primero. Toca uno o elige otro.' : 'Primero la familia, después el dripper exacto.'} />
          {myDrippers.length > 0 && (
            <div className="flex flex-col gap-2">
              <Eyebrow className="text-[10px]">Mi equipo</Eyebrow>
              <div className="flex flex-wrap gap-2">
                {myDrippers.map((d) => {
                  const f = METHOD_FAMILIES.find((x) => x.drippers.includes(d))
                  return (
                    <Chip
                      key={d}
                      active={dripper === d}
                      onClick={() => {
                        setDripper(d)
                        if (f) chooseFamily(f.id)
                      }}
                    >
                      {d}
                    </Chip>
                  )
                })}
                <Chip active={showAllMethods && !myDrippers.includes(dripper ?? '')} onClick={() => setShowAllMethods(!showAllMethods)}>
                  Otro método
                </Chip>
              </div>
            </div>
          )}
          {showAllMethods && (
          <div className="grid grid-cols-2 gap-2.5">
            {METHOD_FAMILIES.map((f) => {
              const active = family === f.id
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => {
                    chooseFamily(f.id)
                    setDripper(f.drippers.length === 1 ? f.drippers[0] : null)
                  }}
                  className={cn(
                    'flex flex-col gap-1 rounded-2xl border px-4 py-4 text-left transition-colors',
                    active ? 'border-foreground bg-foreground text-background' : 'border-border bg-card',
                  )}
                >
                  <span className="text-[15px] font-medium">{f.label}</span>
                  <span className={cn('text-xs', active ? 'text-background/70' : 'text-muted-foreground')}>{f.hint}</span>
                </button>
              )
            })}
          </div>
          )}
          {showAllMethods && fam && fam.drippers.length > 1 && (
            <div className="flex flex-col gap-2 pt-1">
              <Eyebrow className="text-[10px]">Dripper</Eyebrow>
              <div className="flex flex-wrap gap-2">
                {fam.drippers.map((d) => (
                  <Chip key={d} active={dripper === d} onClick={() => setDripper(d)}>
                    {d}
                  </Chip>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Paso 3: cantidad */}
      {step === 3 && (
        <section className="flex flex-col gap-4 px-6 pt-4">
          <StepTitle
            n={3}
            title="¿Cuánto café?"
            hint={isEspresso ? 'Gramos de café en el portafiltro.' : `Indica los gramos de café. Calculamos el agua con ratio 1:${ratio} y para cuántas personas alcanza (200 ml por persona).`}
          />
          <div className="flex items-center justify-between rounded-2xl bg-card px-5 py-4">
            <button type="button" onClick={() => bumpDose(-1)} className="flex size-11 items-center justify-center rounded-full border border-border-strong" aria-label="Menos café">
              <Minus className="size-4" />
            </button>
            <div className="flex flex-col items-center">
              <div className="flex items-baseline gap-1">
                <input
                  inputMode="decimal"
                  value={dose.replace('.', ',')}
                  onChange={(e) => setDose(e.target.value.replace(',', '.').replace(/[^0-9.]/g, ''))}
                  onBlur={() => setDose(String(Math.max(1, doseNum || 1)))}
                  aria-label="Gramos de café"
                  className="w-[88px] bg-transparent text-center text-[40px] font-medium leading-none tracking-tightest outline-none"
                />
                <span className="text-lg text-muted-foreground">g</span>
              </div>
              <span className="pt-1 text-xs text-muted-foreground">
                {isEspresso ? 'de café molido' : `de café · ${waterMl} ml de agua`}
              </span>
            </div>
            <button type="button" onClick={() => bumpDose(1)} className="flex size-11 items-center justify-center rounded-full border border-border-strong" aria-label="Más café">
              <Plus className="size-4" />
            </button>
          </div>

          {!isEspresso && people !== null && (
            <div className="flex items-center justify-between rounded-2xl border border-border px-5 py-3">
              <div className="flex flex-col">
                <Eyebrow className="text-[10px]">Para cuántos</Eyebrow>
                <span className="text-sm text-muted-foreground">
                  {people} {people === 1 ? 'persona' : 'personas'} · {ML_PER_PERSON} ml c/u
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setPeople(people - 1)} className="flex size-9 items-center justify-center rounded-full border border-border-strong" aria-label="Menos personas">
                  <Minus className="size-3.5" />
                </button>
                <span className="w-6 text-center text-lg font-medium">{people}</span>
                <button type="button" onClick={() => setPeople(people + 1)} className="flex size-9 items-center justify-center rounded-full border border-border-strong" aria-label="Más personas">
                  <Plus className="size-3.5" />
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Paso 4: equipo y preferencia */}
      {step === 4 && (
        <section className="flex flex-col gap-4 px-6 pt-4">
          <StepTitle n={4} title="Afinemos" hint="Opcional. Ayuda a ajustar molienda y perfil." />
          <Field label="Mi equipo" hint={profileEquipment && equipmentToText(profileEquipment) ? 'Tomado de tu perfil. Puedes ajustarlo solo para esta receta.' : 'Molino, balanza, hervidor. Guárdalo en Perfil para no escribirlo cada vez.'}>
            <Input value={equipment} onChange={(e) => setEquipment(e.target.value)} placeholder="Ej. Comandante C40" />
          </Field>
          <div className="flex flex-col gap-2">
            <Eyebrow className="text-[10px]">¿Qué buscas en la taza?</Eyebrow>
            <div className="flex flex-wrap gap-2">
              {TASTE_PREFERENCES.map((p) => (
                <Chip key={p} active={pref === p} onClick={() => setPref(pref === p ? null : p)}>
                  {p}
                </Chip>
              ))}
            </div>
          </div>
          {taste && tasteSummary(taste).length > 0 && (
            <button
              type="button"
              onClick={() => setUseTaste((v) => !v)}
              className={cn('flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition-colors', useTaste ? 'border-foreground bg-card' : 'border-border')}
            >
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-[13px] font-medium">Usar mi perfil de gusto</span>
                <span className="truncate text-xs text-muted-foreground">{tasteSummary(taste).join(' · ')}</span>
              </span>
              <span className={cn('size-5 shrink-0 rounded-full border-2', useTaste ? 'border-foreground bg-foreground' : 'border-border-strong')} />
            </button>
          )}
          <Summary log={log} other={useOther ? otherCoffee : null} dripper={dripper} people={isEspresso ? null : people} dose={dose} waterMl={waterMl} />
        </section>
      )}

      {/* Resultado */}
      {step === 'result' && (
        <section className="flex flex-col gap-4 px-6 pt-4">
          {generating && (
            <div className="flex flex-col gap-4">
              <Spinner label="Diseñando la receta para este café..." />
              <Skeleton className="h-[420px] rounded-[20px]" />
            </div>
          )}
          {recipe && (
            <>
              <RecipeCard r={recipe} />
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={generate} disabled={saving}>
                  <RotateCcw strokeWidth={1.6} /> Otra versión
                </Button>
                <Button className="flex-1" onClick={save} disabled={saving || savedOk}>
                  {savedOk ? 'Guardada' : saving ? 'Guardando...' : 'Guardar receta'}
                </Button>
              </div>
              <button type="button" onClick={reset} className="self-center pt-1 text-[13px] font-medium text-muted-foreground">
                Empezar otra receta
              </button>
            </>
          )}
          {!generating && !recipe && (
            <Button variant="outline" onClick={() => setStep(4)}>
              Volver
            </Button>
          )}
        </section>
      )}

      {/* Navegación del wizard */}
      {step !== 'result' && (
        <div className="flex gap-3 px-6 pt-8">
          {step > 1 && (
            <Button variant="outline" size="icon" className="size-[54px] rounded-[14px]" onClick={() => setStep((step - 1) as Step)} aria-label="Atrás">
              <ChevronLeft className="size-5" strokeWidth={1.8} />
            </Button>
          )}
          {step < 4 ? (
            <Button className="flex-1" disabled={!canNext[step]} onClick={() => setStep((step + 1) as Step)}>
              Continuar
            </Button>
          ) : (
            <Button className="flex-1" onClick={generate}>
              Generar receta con IA
            </Button>
          )}
        </div>
      )}

      {/* Recetario */}
      {step === 1 && saved && saved.length > 0 && (
        <section className="flex flex-col gap-3 px-6 pt-10 pb-6">
          <Separator />
          <Eyebrow className="pt-4 text-[10px]">Mis recetas guardadas</Eyebrow>
          <ul className="flex flex-col">
            {saved.slice(0, 10).map((r, i) => (
              <li key={r.id}>
                <Link to={r.coffee_log_id ? `/log/${r.coffee_log_id}` : '#'} className="flex items-center justify-between gap-3 py-3.5">
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-[15px] font-medium">{r.title ?? r.brew_method}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {[r.coffee?.roaster?.name, r.coffee?.name].filter(Boolean).join(' · ') || 'Sin café asociado'}
                    </span>
                  </div>
                  <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium">{r.brew_method}</span>
                </Link>
                {i < Math.min(saved.length, 10) - 1 && <Separator />}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function StepTitle({ n, title, hint }: { n: number; title: string; hint: string }) {
  return (
    <div className="flex flex-col gap-1">
      <Eyebrow className="text-[10px]">Paso {n}</Eyebrow>
      <h2 className="text-[24px] font-medium leading-tight tracking-[-0.02em]">{title}</h2>
      <p className="text-sm text-muted-foreground">{hint}</p>
    </div>
  )
}

function Summary({
  log,
  other,
  dripper,
  people,
  dose,
  waterMl,
}: {
  log: CoffeeLog | null
  other: string | null
  dripper: string | null
  people: number | null
  dose: string
  waterMl: number | null
}) {
  const coffee = log ? [log.coffee?.roaster?.name, log.coffee?.name].filter(Boolean).join(' · ') : other || 'Café general'
  return (
    <div className="flex flex-col gap-1.5 rounded-2xl bg-card px-4 py-3.5 text-sm">
      <Row k="Café" v={coffee} />
      <Row k="Método" v={dripper ?? '—'} />
      <Row k="Cantidad" v={`${dose.replace('.', ',')} g de café${waterMl ? ` · ${waterMl} ml de agua` : ''}`} />
      {people !== null && <Row k="Para" v={`${people} ${people === 1 ? 'persona' : 'personas'}`} />}
    </div>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{k}</span>
      <span className="truncate text-right font-medium">{v}</span>
    </div>
  )
}
