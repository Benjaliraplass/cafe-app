import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Star } from 'lucide-react'
import type { Coffee, CoffeePublicStats, FeaturedRecipe } from '@/lib/types'
import { photoUrl } from '@/lib/supabase'
import { Photo } from '@/components/primitives'
import { cn } from '@/lib/utils'

export const AUTHOR_ROLE_LABEL: Record<FeaturedRecipe['author_role'], string> = {
  tostador: 'Tostador',
  campeon: 'Campeón',
  barista: 'Barista',
  otro: '',
}

/** Fila con scroll horizontal (estilo Vivino) para tarjetas de Inicio. */
export function HScroll({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('-mx-6 flex snap-x snap-mandatory gap-3 overflow-x-auto px-6 pb-1 scroll-pl-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden', className)}>
      {children}
    </div>
  )
}

/** Tarjeta de receta destacada: foto arriba, autor y evento, título y método. */
export function FeaturedRecipeCard({ r, className }: { r: FeaturedRecipe; className?: string }) {
  const sub = [r.author, r.event ?? (AUTHOR_ROLE_LABEL[r.author_role] || null)].filter(Boolean).join(' · ')
  return (
    <Link
      to={`/r/${r.slug}`}
      className={cn('flex w-[240px] shrink-0 snap-start flex-col gap-2.5 rounded-[20px] bg-card p-2.5 transition-transform active:scale-[0.985]', className)}
    >
      <Photo src={photoUrl(r.photo_path)} className="aspect-[4/3] w-full rounded-[14px]" />
      <div className="flex flex-col gap-1 px-1.5 pb-1.5">
        <span className="eyebrow truncate text-[10px]">{sub}</span>
        <span className="line-clamp-2 text-[15px] font-medium leading-snug tracking-[-0.01em]">{r.title}</span>
        <span className="text-xs text-muted-foreground">
          {r.dripper}
          {r.params.dose_g ? ` · ${r.params.dose_g} g` : ''}
          {r.country ? ` · ${r.country}` : ''}
        </span>
      </div>
    </Link>
  )
}

/** Tarjeta de café del catálogo público. */
export function CoffeeCard({ c, stats, className }: { c: Coffee; stats?: CoffeePublicStats | null; className?: string }) {
  const meta = [c.origin_country, c.process].filter(Boolean).join(' · ')
  return (
    <Link
      to={`/c/${c.id}`}
      className={cn('flex w-[168px] shrink-0 snap-start flex-col gap-2.5 rounded-[20px] bg-card p-2.5 transition-transform active:scale-[0.985]', className)}
    >
      <Photo src={photoUrl(c.photo_path)} className="aspect-square w-full rounded-[14px]" />
      <div className="flex flex-col gap-0.5 px-1 pb-1">
        <span className="eyebrow truncate text-[10px]">{c.roaster?.name ?? 'Tostador'}</span>
        <span className="line-clamp-2 text-[15px] font-medium leading-snug tracking-[-0.01em]">{c.name}</span>
        <span className="truncate text-xs text-muted-foreground">{meta || '—'}</span>
        {stats?.avg_rating != null && (
          <span className="flex items-center gap-1 pt-0.5 text-xs">
            <Star className="size-3 fill-current" /> {stats.avg_rating.toFixed(1).replace('.', ',')}
            <span className="text-tertiary">({stats.ratings_count})</span>
          </span>
        )}
      </div>
    </Link>
  )
}

/** Encabezado de sección con enlace "Ver todo" opcional. */
export function SectionHeader({ title, to, hint }: { title: string; to?: string; hint?: string }) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-[20px] font-medium tracking-[-0.02em]">{title}</h2>
        {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
      </div>
      {to && (
        <Link to={to} className="shrink-0 text-[13px] font-medium text-muted-foreground underline-offset-4 hover:underline">
          Ver todo
        </Link>
      )}
    </div>
  )
}
