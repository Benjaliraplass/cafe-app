import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, Camera, ChevronRight } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { listFeaturedRecipes, listMyLogs, listPublishedCoffees, type Profile } from '@/lib/api'
import { recommendCoffees } from '@/lib/recommend'
import { avatarUrl } from '@/lib/supabase'
import type { Coffee, CoffeeLog, FeaturedRecipe } from '@/lib/types'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorBox, Eyebrow, Title } from '@/components/primitives'
import { CoffeeCard, FeaturedRecipeCard, HScroll, SectionHeader } from '@/components/cards'

export function Inicio() {
  const { user, profile } = useAuth()
  const [featured, setFeatured] = useState<FeaturedRecipe[] | null>(null)
  const [coffees, setCoffees] = useState<Coffee[] | null>(null)
  const [logs, setLogs] = useState<CoffeeLog[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    Promise.all([listFeaturedRecipes(), listPublishedCoffees(30), listMyLogs(user.id)])
      .then(([f, c, l]) => {
        setFeatured(f)
        setCoffees(c)
        setLogs(l)
      })
      .catch((e) => setError(e.message))
  }, [user])

  return (
    <InicioView
      email={user?.email ?? ''}
      profile={profile}
      featured={featured}
      recommended={coffees && logs ? recommendCoffees(coffees, logs) : null}
      logsCount={logs?.length ?? 0}
      error={error}
    />
  )
}

export function InicioView({
  email,
  profile,
  featured,
  recommended,
  logsCount,
  error,
}: {
  email: string
  profile: Profile | null
  featured: FeaturedRecipe[] | null
  recommended: Coffee[] | null
  logsCount: number
  error: string | null
}) {
  const name = profile?.display_name?.trim().split(' ')[0] || email.split('@')[0]
  const src = avatarUrl(profile?.avatar_url)

  return (
    <div className="flex flex-col gap-9 pb-4">
      <header className="flex items-center justify-between gap-4 px-6 pt-4">
        <div className="flex flex-col gap-1.5">
          <Eyebrow>{greeting()}</Eyebrow>
          <Title className="text-[34px]">{name}</Title>
        </div>
        <Link to="/profile" aria-label="Perfil" className="size-12 shrink-0 overflow-hidden rounded-full bg-muted ring-1 ring-border">
          {src ? (
            <img src={src} alt="" className="size-full object-cover" />
          ) : (
            <span className="flex size-full items-center justify-center text-lg font-medium text-muted-foreground">{name.charAt(0).toUpperCase()}</span>
          )}
        </Link>
      </header>

      <div className="px-6">
        <ErrorBox message={error} />
      </div>

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

      {/* Accesos rápidos */}
      <section className="flex flex-col gap-3 px-6">
        <QuickLink to="/recipes" icon={<BookOpen className="size-5" strokeWidth={1.7} />} title="Pedir una receta" body="A medida para tu café, tu método y tu equipo." />
        <QuickLink to="/scan" icon={<Camera className="size-5" strokeWidth={1.7} />} title="Escanear un café" body="Foto a la etiqueta y lo guardamos en tu diario." />
      </section>
    </div>
  )
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
