import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, Minus, Plus, RotateCcw } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { coffeeFromLog, listMyLogs, listMyRecipes, saveRecipe, suggestRecipe, type SavedRecipe, type SuggestRecipeInput } from '@/lib/api'
import { photoUrl } from '@/lib/supabase'
import { METHOD_FAMILIES, TASTE_PREFERENCES, type CoffeeLog, type MethodFamily, type RecipeData } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorBox, Eyebrow, Field, Photo, Spinner, Title } from '@/components/primitives'
import { RecipeCard } from '@/pages/LogDetail'
import { cn } from '@/lib/utils'

type Step = 1 | 2 | 3 | 4 | 'result'

export function Recipes() {
  const { user } = useAuth()
  const [logs, setLogs] = useState<CoffeeLog[] | null>(null)
  const [saved, setSaved] = useState<SavedRecipe[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    Promise.all([listMyLogs(user.id), listMyRecipes(user.id)])
      .then(([l, r]) => {
        setLogs(l)
        setSaved(r)
      })
      .catch((e) => setError(e.message))
  }, [user])

  return (
    <RecipesView
      logs={logs}
      saved={saved}
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
  error: outerError,
  onGenerate,
  onSave,
}: {
  logs: CoffeeLog[] | null
  saved: SavedRecipe[] | null
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
  const [servings, setServings] = useState(1)
  const [doseMode, setDoseMode] = useState(false)
  const [dose, setDose] = useState('18')
  const [equipment, setEquipment] = useState('')
  const [pref, setPref] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [recipe, setRecipe] = useState<RecipeData | null>(null)
  const [saving, setSaving] = useState(false)
  const [savedOk, setSavedOk] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fam = useMemo(() => METHOD_FAMILIES.find((f) => f.id === family) ?? null, [family])
  const isEspresso = family === 'espresso'

  const canNext: Record<Exclude<Step, 'result'>, boolean> = {
    1: !!log || (useOther && otherCoffee.trim().length > 2),
    2: !!family && !!dripper,
    3: isEspresso ? Number(dose) > 0 : doseMode ? Number(dose) > 0 : servings > 0,
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
        servings: !isEspresso && !doseMode ? servings : undefined,
        dose_g: isEspresso || doseMode ? Number(dose) : undefined,
        equipment: equipment.trim() || undefined,
        preferences: pref ?? undefined,
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
          <StepTitle n={2} title="¿Qué método?" hint="Primero la familia, después el dripper exacto." />
          <div className="grid grid-cols-2 gap-2.5">
            {METHOD_FAMILIES.map((f) => {
              const active = family === f.id
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => {
                    setFamily(f.id)
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
          {fam && fam.drippers.length > 1 && (
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
            title={isEspresso ? '¿Cuánta dosis?' : '¿Para cuántos?'}
            hint={isEspresso ? 'Gramos de café en el portafiltro.' : 'Una taza equivale a 250 g de agua.'}
          />
          {!isEspresso && !doseMode && (
            <div className="flex items-center justify-between rounded-2xl bg-card px-5 py-4">
              <button type="button" onClick={() => setServings(Math.max(1, servings - 1))} className="flex size-11 items-center justify-center rounded-full border border-border-strong" aria-label="Menos">
                <Minus className="size-4" />
              </button>
              <div className="flex flex-col items-center">
                <span className="text-[40px] font-medium leading-none tracking-tightest">{servings}</span>
                <span className="pt-1 text-xs text-muted-foreground">{servings === 1 ? 'taza' : 'tazas'} · {servings * 250} g de agua</span>
              </div>
              <button type="button" onClick={() => setServings(Math.min(6, servings + 1))} className="flex size-11 items-center justify-center rounded-full border border-border-strong" aria-label="Más">
                <Plus className="size-4" />
              </button>
            </div>
          )}
          {(isEspresso || doseMode) && (
            <Field label="Gramos de café">
              <Input inputMode="decimal" value={dose} onChange={(e) => setDose(e.target.value.replace(',', '.'))} placeholder={isEspresso ? '18' : '15'} />
            </Field>
          )}
          {!isEspresso && (
            <button type="button" onClick={() => setDoseMode(!doseMode)} className="self-start text-[13px] font-medium text-muted-foreground underline-offset-4 hover:underline">
              {doseMode ? 'Prefiero elegir por tazas' : 'Prefiero indicar gramos de café'}
            </button>
          )}
        </section>
      )}

      {/* Paso 4: equipo y preferencia */}
      {step === 4 && (
        <section className="flex flex-col gap-4 px-6 pt-4">
          <StepTitle n={4} title="Afinemos" hint="Opcional. Ayuda a ajustar molienda y perfil." />
          <Field label="Mi equipo" hint="Molino, balanza, hervidor. Ej. Comandante C40, V60 02 plástico">
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
          <Summary log={log} other={useOther ? otherCoffee : null} dripper={dripper} servings={isEspresso || doseMode ? null : servings} dose={isEspresso || doseMode ? dose : null} />
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
  servings,
  dose,
}: {
  log: CoffeeLog | null
  other: string | null
  dripper: string | null
  servings: number | null
  dose: string | null
}) {
  const coffee = log ? [log.coffee?.roaster?.name, log.coffee?.name].filter(Boolean).join(' · ') : other || 'Café general'
  return (
    <div className="flex flex-col gap-1.5 rounded-2xl bg-card px-4 py-3.5 text-sm">
      <Row k="Café" v={coffee} />
      <Row k="Método" v={dripper ?? '—'} />
      <Row k="Cantidad" v={dose ? `${dose} g de café` : `${servings} ${servings === 1 ? 'taza' : 'tazas'}`} />
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
