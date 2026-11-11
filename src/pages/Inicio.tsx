import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, Camera, ChevronRight } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { getTasteProfile, listCafes, listFeaturedRecipes, listMyLogs, listMyRecipes, listPublishedCoffees, type Profile, type SavedRecipe } from '@/lib/api'
import type { TasteProfile } from '@/lib/taste'
import { distanceKm, formatDistance, silentPosition, type LatLng } from '@/lib/geo'
import { recommendCoffees } from '@/lib/recommend'
import { avatarUrl } from '@/lib/supabase'
import { isPendingLog, type Cafe, type Coffee, type CoffeeLog, type FeaturedRecipe } from '@/lib/types'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorBox, Eyebrow, Title } from '@/components/primitives'
import { CafeRow, CoffeeCard, FeaturedRecipeCard, HScroll, LogCard, SavedRecipeCard, SectionHeader } from '@/components/cards'

export function Inicio() {
  const { user, profile } = useAuth()
  const [featured, setFeatured] = useState<FeaturedRecipe[] | null>(null)
  const [coffees, setCoffees] = useState<Coffee[] | null>(null)
  const [logs, setLogs] = useState<CoffeeLog[] | null>(null)
  const [recipes, setRecipes] = useState<SavedRecipe[] | null>(null)
  const [cafes, setCafes] = useState<Cafe[] | null>(null)
  const [me, setMe] = useState<LatLng | null>(null)
  const [taste, setTaste] = useState<TasteProfile | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    getTasteProfile(user.id).then(setTaste).catch(() => {})
    Promise.all([listFeaturedRecipes(), listPublishedCoffees(30), listMyLogs(user.id), listMyRecipes(user.id).catch(() => [] as SavedRecipe[])])
      .then(([f, c, l, r]) => {
        setFeatured(f)
        setCoffees(c)
        setLogs(l)
        setRecipes(r)
      })
      .catch((e) => setError(e.message))
    listCafes().then(setCafes).catch(() => setCafes([]))
    silentPosition().then(setMe)
  }, [user])

  return (
    <InicioView
      email={user?.email ?? ''}
      profile={profile}
      featured={featured}
      recommended={coffees && logs ? recommendCoffees(coffees, logs, 10, taste) : null}
      logs={logs}
      recipes={recipes}
      cafes={cafes}
      me={me}
      error={error}
    />
  )
}

export function InicioView({
  email,
  profile,
  featured,
  recommended,
  logs,
  recipes = null,
  cafes,
  me,
  error,
}: {
  email: string
  profile: Profile | null
  featured: FeaturedRecipe[] | null
  recommended: Coffee[] | null
  logs: CoffeeLog[] | null
  recipes?: SavedRecipe[] | null
  cafes: Cafe[] | null
  me: LatLng | null
  error: string | null
}) {
  const logsCount = logs?.length ?? 0
  const recent = (logs ?? []).slice(0, 8)
  const savedRecipes = (recipes ?? []).slice(0, 6)
  const recipesCount = recipes?.length ?? 0
  const streak = weeklyStreak((logs ?? []).map((l) => l.consumed_at))
  // Con ubicación: las más cercanas. Sin ubicación: las últimas aprobadas (no un orden alfabético que parece arbitrario).
  const nearby = (cafes ?? [])
    .filter((c) => c.lat != null && c.lng != null)
    .map((c) => ({ c, km: me ? distanceKm(me, { lat: c.lat!, lng: c.lng! }) : null }))
    .sort((a, b) => (me ? (a.km ?? 0) - (b.km ?? 0) : (b.c.created_at ?? '').localeCompare(a.c.created_at ?? '')))
    .slice(0, 4)
  const name = profile?.display_name?.trim().split(' ')[0] || email.split('@')[0]
  const src = avatarUrl(profile?.avatar_url)

  return (
    <div className="flex flex-col gap-9 pb-4">
      <header className="flex items-center justify-between gap-4 px-6 pt-4">
        <div className="flex flex-col gap-1.5">
          <Eyebrow>{greeting()}</Eyebrow>
          <Title className="text-[34px]">{name}</Title>
          <p className="text-[15px] text-muted-foreground">{quip(logsCount)}</p>
        </div>
        <Link to="/profile" aria-label="Perfil" className="size-12 shrink-0 overflow-hidden rounded-full bg-muted ring-1 ring-border">
          {src ? (
            <img src={src} alt="" className="size-full object-cover" />
          ) : (
            <span className="flex size-full items-center justify-center text-lg font-medium text-muted-foreground">{name.charAt(0).toUpperCase()}</span>
          )}
        </Link>
      </header>

      {/* Tu diario en números (estilo Untappd): cafés, recetas guardadas, semanas seguidas */}
      {logsCount > 0 && (
        <section className="-mt-6 px-6">
          <p className="inline-flex items-baseline gap-x-2 rounded-full bg-card px-3.5 py-2 text-[13px] text-muted-foreground">
            <Stat value={logsCount} label={logsCount === 1 ? 'café' : 'cafés'} />
            <span aria-hidden>·</span>
            <Stat value={recipesCount} label={recipesCount === 1 ? 'receta' : 'recetas'} />
            <span aria-hidden>·</span>
            <Stat value={streak} label={streak === 1 ? 'semana' : 'semanas'} />
          </p>
        </section>
      )}

      {error && (
        <div className="px-6">
          <ErrorBox message={error} />
        </div>
      )}

      {/* Últimos escaneos */}
      <section className="flex flex-col gap-4 px-6">
        <SectionHeader title="Tus últimos escaneos" hint={logsCount ? `${logsCount} ${logsCount === 1 ? 'café' : 'cafés'} en tu diario.` : 'Tu diario empieza con una foto a la etiqueta.'} to={logsCount ? '/logs' : undefined} />
        {logs === null ? (
          <HScroll>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-[236px] w-[150px] shrink-0 rounded-[20px]" />
            ))}
          </HScroll>
        ) : recent.length === 0 ? (
          <Link to="/scan" className="flex items-center gap-4 rounded-[20px] border border-dashed border-border-strong px-4 py-5 transition-colors active:bg-card">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-foreground text-background">
              <Camera className="size-5" strokeWidth={1.7} />
            </span>
            <span className="flex flex-col">
              <span className="text-[15px] font-medium">Escanea tu primer café</span>
              <span className="text-sm text-muted-foreground">Leemos la etiqueta y llenamos la ficha por ti.</span>
            </span>
          </Link>
        ) : (
          <HScroll>
            {recent.map((l) => (
              <LogCard key={l.id} log={l} />
            ))}
            <Link to="/scan" className="flex w-[150px] shrink-0 snap-start flex-col items-center justify-center gap-2 rounded-[20px] border border-dashed border-border-strong text-center">
              <span className="flex size-10 items-center justify-center rounded-full bg-foreground text-background">
                <Camera className="size-4" strokeWidth={1.8} />
              </span>
              <span className="px-3 text-sm font-medium">Escanear otro</span>
            </Link>
          </HScroll>
        )}
      </section>

      {/* Recetas: pedir una para hoy + las guardadas */}
      {logs !== null && (() => {
        // El café por probar más reciente es el candidato natural; si no hay, el último escaneado.
        const last = recent.find(isPendingLog) ?? recent[0]
        const dripper = profile?.equipment?.drippers?.[0] ?? 'V60'
        const to = last ? `/recipes?log=${last.id}&dripper=${encodeURIComponent(dripper)}` : '/recipes'
        const headline = last?.coffee ? `Prepara ${last.coffee.name} en ${dripper}` : 'Pide una receta a medida'
        const body = last?.coffee ? 'Con tu equipo y tu perfil de gusto, en dos toques.' : 'Elige café, método y cantidad; la IA hace el resto.'
        if (savedRecipes.length === 0) {
          return (
            <section className="px-6">
              <Link to={to} className="flex items-center gap-4 rounded-[22px] bg-foreground px-5 py-4 text-background transition-transform active:scale-[0.99]">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-background/15">
                  <BookOpen className="size-5" strokeWidth={1.7} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="eyebrow text-[10px] text-background/70">Receta para hoy</span>
                  <span className="truncate text-[17px] font-medium leading-tight">{headline}</span>
                  <span className="truncate text-[13px] text-background/70">{body}</span>
                </span>
                <ChevronRight className="size-5 shrink-0 text-background/70" strokeWidth={1.7} />
              </Link>
            </section>
          )
        }
        return (
          <section className="flex flex-col gap-4 px-6">
            <SectionHeader title="Tus recetas" hint="La de hoy y las que guardaste." to="/recipes?view=saved" />
            <HScroll>
              <Link to={to} className="flex h-[132px] w-[220px] shrink-0 snap-start flex-col justify-between rounded-[20px] bg-foreground px-4 py-3.5 text-background transition-transform active:scale-[0.985]">
                <span className="eyebrow text-[10px] text-background/70">Receta para hoy</span>
                <span className="line-clamp-2 text-[15px] font-medium leading-snug tracking-[-0.01em]">{headline}</span>
                <span className="flex items-center gap-1 text-xs text-background/70">
                  Pedir ahora <ChevronRight className="size-3.5" strokeWidth={2} />
                </span>
              </Link>
              {savedRecipes.map((r) => (
                <SavedRecipeCard key={r.id} r={r} coffeeName={r.coffee?.name} />
              ))}
            </HScroll>
          </section>
        )
      })()}

      {/* Recetas destacadas */}
      <section className="flex flex-col gap-4 px-6">
        <SectionHeader title="Recetas destacadas" hint="De tostadores y campeones del mundo." to="/featured" />
        {featured === null ? (
          <HScroll>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-[260px] w-[240px] shrink-0 rounded-[20px]" />
            ))}
          </HScroll>
        ) : featured.length === 0 ? (
          <p className="rounded-2xl bg-card px-4 py-5 text-sm text-muted-foreground">Pronto. Estamos curando las primeras recetas.</p>
        ) : (
          <HScroll>
            {featured.map((r) => (
              <FeaturedRecipeCard key={r.id} r={r} />
            ))}
          </HScroll>
        )}
      </section>

      {/* Cafés que van contigo */}
      <section className="flex flex-col gap-4 px-6">
        <SectionHeader
          title="Cafés que van contigo"
          hint={logsCount ? 'Según los cafés que más te gustaron.' : 'Lo último del catálogo. Escanea tus cafés y afinamos la selección.'}
          to="/catalog"
        />
        {recommended === null ? (
          <HScroll>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-[250px] w-[168px] shrink-0 rounded-[20px]" />
            ))}
          </HScroll>
        ) : recommended.length === 0 ? (
          <p className="rounded-2xl bg-card px-4 py-5 text-sm text-muted-foreground">Aún no hay cafés publicados en el catálogo.</p>
        ) : (
          <HScroll>
            {recommended.map((c) => (
              <CoffeeCard key={c.id} c={c} />
            ))}
          </HScroll>
        )}
      </section>

      {/* Cafeterías cerca */}
      {cafes && cafes.length > 0 && (
        <section className="flex flex-col gap-3 px-6">
          <SectionHeader title={me ? 'Cafeterías cerca' : 'Cafeterías de especialidad'} hint={me ? 'Ordenadas por distancia.' : 'Las últimas agregadas. Activa tu ubicación en Explorar para verlas por cercanía.'} to="/explore" />
          <ul className="flex flex-col divide-y divide-border">
            {nearby.map(({ c, km }) => (
              <CafeRow key={c.id} c={c} distance={km != null ? formatDistance(km) : null} />
            ))}
          </ul>
        </section>
      )}

      {/* Accesos rápidos */}
      <section className="flex flex-col gap-3 px-6">
        <QuickLink to="/recipes" icon={<BookOpen className="size-5" strokeWidth={1.7} />} title="Pedir una receta" body="A medida para tu café, tu método y tu equipo." />
        <QuickLink to="/scan" icon={<Camera className="size-5" strokeWidth={1.7} />} title="Escanear un café" body="Foto a la etiqueta y lo guardamos en tu diario." />
      </section>
    </div>
  )
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <span className="whitespace-nowrap">
      <span className="font-medium text-foreground">{value}</span> {label}
    </span>
  )
}

/** Semanas consecutivas (hasta la actual o la anterior) con al menos un café registrado. */
export function weeklyStreak(dates: string[]): number {
  if (dates.length === 0) return 0
  const weekIndex = (d: Date) => Math.floor((d.getTime() - d.getTimezoneOffset() * 60_000) / (7 * 86_400_000))
  const weeks = new Set(dates.map((iso) => weekIndex(new Date(iso + (iso.length === 10 ? 'T12:00:00' : '')))))
  let w = weekIndex(new Date())
  // Si esta semana aún no hay café, la racha sigue viva desde la semana pasada.
  if (!weeks.has(w)) w -= 1
  let n = 0
  while (weeks.has(w)) {
    n += 1
    w -= 1
  }
  return n
}

function QuickLink({ to, icon, title, body }: { to: string; icon: React.ReactNode; title: string; body: string }) {
  return (
    <Link to={to} className="flex items-center gap-4 rounded-[20px] bg-card px-4 py-4 transition-transform active:scale-[0.99]">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-background">{icon}</span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[15px] font-medium">{title}</span>
        <span className="truncate text-sm text-muted-foreground">{body}</span>
      </span>
      <ChevronRight className="size-5 shrink-0 text-tertiary" strokeWidth={1.7} />
    </Link>
  )
}

function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Buenos días'
  if (h < 20) return 'Buenas tardes'
  return 'Buenas noches'
}

/**
 * Frase corta según la hora. Varias por franja; se elige por día (no por recarga) para que
 * cambie a diario sin parpadear. Sin emojis, tono cercano y neutro.
 */
const QUIPS: Record<string, string[]> = {
  madrugada: ['¿Todavía despierto? Ese café fue fuerte.', 'A esta hora, mejor un descafeinado.', 'El café también sabe mejor con sueño.'],
  manana: ['¿Ya pasó el primer café?', 'Hora de moler. ¿Qué toca hoy?', 'Un buen día empieza con una buena extracción.', 'El agua ya debería estar hirviendo.'],
  mediodia: ['¿Café después de almuerzo? Siempre.', 'Buen momento para un filtrado largo.', 'Mitad del día, segunda taza.'],
  tarde: ['La taza de la tarde es la mejor del día.', '¿Un espresso para rematar la jornada?', 'Hora perfecta para probar algo nuevo.', '¿Qué estás tomando ahora?'],
  noche: ['¿Aún tomando café?', 'Café de noche: valiente.', '¿Un último sorbo antes de dormir?', 'Mañana se muele de nuevo.'],
}

function quip(logsCount: number): string {
  const d = new Date()
  const h = d.getHours()
  const slot = h < 6 ? 'madrugada' : h < 12 ? 'manana' : h < 15 ? 'mediodia' : h < 20 ? 'tarde' : 'noche'
  if (logsCount === 0 && slot !== 'madrugada') return 'Tu diario está vacío. Escanea tu primer café.'
  const list = QUIPS[slot]
  const dayIndex = Math.floor(d.getTime() / 86_400_000)
  return list[dayIndex % list.length]
}
