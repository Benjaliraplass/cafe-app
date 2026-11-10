import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, ExternalLink, Share2 } from 'lucide-react'
import { getFeaturedRecipe, listFeaturedRecipes } from '@/lib/api'
import { photoUrl } from '@/lib/supabase'
import { absoluteUrl, shareLink } from '@/lib/share'
import type { FeaturedRecipe as FeaturedRecipeT } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Eyebrow, Photo, Spinner, Title } from '@/components/primitives'
import { AUTHOR_ROLE_LABEL, FeaturedRecipeCard } from '@/components/cards'

/** Ficha pública de una receta destacada: /r/:slug */
export function FeaturedRecipePage() {
  const { slug } = useParams<{ slug: string }>()
  const [recipe, setRecipe] = useState<FeaturedRecipeT | null | undefined>(undefined)
  useEffect(() => {
    if (!slug) return
    getFeaturedRecipe(slug)
      .then(setRecipe)
      .catch(() => setRecipe(null))
  }, [slug])

  if (recipe === undefined) {
    return (
      <div className="px-6 pt-8">
        <Spinner label="Cargando..." />
      </div>
    )
  }
  if (recipe === null) {
    return (
      <div className="px-6 pt-8">
        <p className="text-muted-foreground">No encontramos esta receta.</p>
        <Link to="/" className="mt-4 inline-block underline underline-offset-4">
          Ir a Inicio
        </Link>
      </div>
    )
  }
  return <FeaturedRecipeView r={recipe} />
}

export function FeaturedRecipeView({ r }: { r: FeaturedRecipeT }) {
  const navigate = useNavigate()
  const [shareState, setShareState] = useState<'idle' | 'copied'>('idle')
  const p = r.params
  const isEspresso = r.method_family === 'espresso'
  const stats: [string, string | null | undefined][] = [
    ['Dosis', p.dose_g ? `${p.dose_g} g` : null],
    isEspresso ? ['Salida', p.yield_g ? `${p.yield_g} g` : null] : ['Agua', p.water_g ? `${p.water_g} g` : null],
    ['Ratio', p.ratio],
    ['Temp.', p.water_temp_c ? `${p.water_temp_c} °C` : null],
    ['Tiempo', p.total_time],
    isEspresso && p.pressure_bar != null ? ['Presión', `${p.pressure_bar} bar`] : ['Molienda', p.grind],
  ]
  const role = AUTHOR_ROLE_LABEL[r.author_role]

  async function share() {
    const res = await shareLink({
      title: `${r.title} · Dripo`,
      text: `${r.title}, por ${r.author}${r.event ? ` (${r.event})` : ''}.`,
      url: absoluteUrl(`/r/${r.slug}`),
    })
    if (res === 'copied') {
      setShareState('copied')
      setTimeout(() => setShareState('idle'), 1800)
    }
  }

  return (
    <div className="pb-6">
      <div className="relative">
        <Photo src={photoUrl(r.photo_path)} className="aspect-[4/3] w-full" />
        <div className="absolute inset-x-0 top-0 flex items-center justify-between px-4 pt-3 safe-top">
          <Button variant="secondary" size="icon" className="bg-background/80 backdrop-blur-md" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))} aria-label="Volver">
            <ChevronLeft strokeWidth={1.8} className="size-5" />
          </Button>
          <Button variant="secondary" size="icon" className="bg-background/80 backdrop-blur-md" onClick={share} aria-label="Compartir">
            <Share2 strokeWidth={1.8} className="size-[18px]" />
          </Button>
        </div>
        {shareState === 'copied' && (
          <span className="absolute right-4 bottom-3 rounded-full bg-foreground px-3 py-1.5 text-xs font-medium text-background">Enlace copiado</span>
        )}
      </div>

      <div className="flex flex-col gap-6 px-6 pt-5">
        <header className="flex flex-col gap-2">
          <Eyebrow>
            {[r.author, r.event ?? (role || null), r.country].filter(Boolean).join(' · ')}
          </Eyebrow>
          <Title className="text-[30px] leading-[1.05]">{r.title}</Title>
          <p className="text-sm text-muted-foreground">
            {r.dripper}
            {role && !r.event ? ` · ${role}` : ''}
          </p>
        </header>

        <div className="grid grid-cols-3 gap-2.5">
          {stats
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <div key={k} className="flex flex-col gap-0.5 rounded-xl bg-card px-3 py-3">
                <span className="text-[10px] font-medium uppercase tracking-eyebrow text-tertiary">{k}</span>
                <span className={String(v).length > 9 ? 'text-sm font-medium leading-tight' : 'text-lg font-medium leading-tight'}>{v}</span>
              </div>
            ))}
        </div>
        {p.grind_reference && <p className="-mt-2 text-sm text-muted-foreground">{p.grind_reference}</p>}

        {r.steps.length > 0 && (
          <Card className="flex flex-col gap-3 p-[18px]">
            <Eyebrow className="text-[10px]">Pasos</Eyebrow>
            <ol className="flex flex-col gap-2.5">
              {r.steps.map((s, i) => (
                <li key={i} className="flex gap-3.5 text-sm">
                  <span className="w-10 shrink-0 font-medium text-tertiary tabular-nums">{s.time}</span>
                  <span>{s.action}</span>
                </li>
              ))}
            </ol>
          </Card>
        )}

        {r.story && (
          <section className="flex flex-col gap-2">
            <Eyebrow className="text-[10px]">Por qué funciona</Eyebrow>
            <p className="text-[15px] leading-relaxed text-foreground/90">{r.story}</p>
          </section>
        )}

        {r.source_url && (
          <a href={r.source_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-muted-foreground underline-offset-4 hover:underline">
            <ExternalLink className="size-4" strokeWidth={1.7} /> Fuente original
          </a>
        )}

        <Button variant="outline" onClick={share}>
          <Share2 className="size-4" strokeWidth={1.8} /> Compartir receta
        </Button>
      </div>
    </div>
  )
}

/** Todas las recetas destacadas publicadas: /featured */
export function FeaturedList() {
  const [items, setItems] = useState<FeaturedRecipeT[] | null>(null)
  useEffect(() => {
    listFeaturedRecipes().then(setItems).catch(() => setItems([]))
  }, [])
  return (
    <div className="flex flex-col gap-6 px-6 pt-4">
      <header className="flex flex-col gap-1.5">
        <Eyebrow>Inicio</Eyebrow>
        <Title className="text-[34px]">Recetas destacadas</Title>
        <p className="text-sm text-muted-foreground">Recetas de tostadores, baristas y campeones del mundo, en nuestras palabras y con enlace a la fuente.</p>
      </header>
      {items === null ? (
        <div className="grid grid-cols-2 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[240px] rounded-[20px]" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {items.map((r) => (
            <FeaturedRecipeCard key={r.id} r={r} className="w-auto" />
          ))}
        </div>
      )}
    </div>
  )
}
