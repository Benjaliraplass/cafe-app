import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, Share2, Star } from 'lucide-react'
import { getPublicCoffee, listPublishedCoffees } from '@/lib/api'
import { avatarUrl, photoUrl } from '@/lib/supabase'
import { absoluteUrl, shareLink } from '@/lib/share'
import { refParam, track, trackPublicView } from '@/lib/analytics'
import { useAuth } from '@/hooks/useAuth'
import type { Coffee, CoffeePublicStats, PublicLog } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { Skeleton } from '@/components/ui/skeleton'
import { Eyebrow, KeyValue, Photo, Rating, Spinner, Title } from '@/components/primitives'
import { CoffeeCard } from '@/components/cards'

/** Ficha pública de un café del catálogo: /c/:id */
export function PublicCoffeePage() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<Awaited<ReturnType<typeof getPublicCoffee>> | undefined>(undefined)
  const { user, loading } = useAuth()
  useEffect(() => {
    if (!id) return
    getPublicCoffee(id)
      .then(setData)
      .catch(() => setData(null))
  }, [id])
  useEffect(() => {
    if (!id || loading) return
    trackPublicView('public_coffee_viewed', 'coffee', { coffee_id: id }, !!user)
  }, [id, loading, user])

  if (data === undefined) {
    return (
      <div className="px-6 pt-8">
        <Spinner label="Cargando..." />
      </div>
    )
  }
  if (data === null) {
    return (
      <div className="px-6 pt-8">
        <p className="text-muted-foreground">No encontramos este café.</p>
        <Link to="/" className="mt-4 inline-block underline underline-offset-4">
          Ir a Inicio
        </Link>
      </div>
    )
  }
  return <PublicCoffeeView coffee={data.coffee} stats={data.stats} logs={data.logs} />
}

export function PublicCoffeeView({ coffee: c, stats, logs }: { coffee: Coffee; stats: CoffeePublicStats | null; logs: PublicLog[] }) {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [copied, setCopied] = useState(false)

  async function share() {
    const res = await shareLink({
      title: `${c.name} · ${c.roaster?.name ?? 'Dripo'}`,
      text: [c.roaster?.name, c.name, c.origin_country, c.process].filter(Boolean).join(' · '),
      url: absoluteUrl(`/c/${c.id}${refParam(profile?.invite_code)}`),
    })
    if (res !== 'failed') track('share_clicked', { type: 'coffee', result: res })
    if (res === 'copied') {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    }
  }

  return (
    <div className="pb-6">
      <div className="relative">
        <Photo src={photoUrl(c.photo_path)} className="aspect-[4/3] w-full" />
        <div className="absolute inset-x-0 top-0 flex items-center justify-between px-4 pt-3 safe-top">
          <Button variant="secondary" size="icon" className="bg-background/80 backdrop-blur-md" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))} aria-label="Volver">
            <ChevronLeft strokeWidth={1.8} className="size-5" />
          </Button>
          <Button variant="secondary" size="icon" className="bg-background/80 backdrop-blur-md" onClick={share} aria-label="Compartir">
            <Share2 strokeWidth={1.8} className="size-[18px]" />
          </Button>
        </div>
        {copied && <span className="absolute right-4 bottom-3 rounded-full bg-foreground px-3 py-1.5 text-xs font-medium text-background">Enlace copiado</span>}
      </div>

      <div className="flex flex-col gap-6 px-6 pt-5">
        <header className="flex flex-col gap-2">
          <Eyebrow>{[c.roaster?.name, c.roaster?.country].filter(Boolean).join(' · ')}</Eyebrow>
          <Title className="text-[32px] leading-[1.05]">{c.name}</Title>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {stats?.avg_rating != null ? (
              <>
                <Star className="size-4 fill-current text-foreground" />
                <span className="font-medium text-foreground">{stats.avg_rating.toFixed(1).replace('.', ',')}</span>
                <span>· {stats.ratings_count} {stats.ratings_count === 1 ? 'puntaje' : 'puntajes'}</span>
              </>
            ) : (
              <span>Sin puntajes públicos todavía</span>
            )}
          </div>
        </header>

        <div className="grid grid-cols-2 gap-x-4 gap-y-4">
          <KeyValue k="Origen" v={[c.origin_country, c.region].filter(Boolean).join(', ')} />
          <KeyValue k="Proceso" v={c.process} />
          <KeyValue k="Variedad" v={c.variety} />
          <KeyValue k="Finca" v={c.farm} />
          <KeyValue k="Productor" v={c.producer} />
          <KeyValue k="Altura" v={c.altitude_masl ? `${c.altitude_masl} msnm` : null} />
          <KeyValue k="Puntaje SCA" v={c.sca_score ? `${c.sca_score} pts` : null} />
          <KeyValue k="Tueste" v={[c.roast_profile ? c.roast_profile.charAt(0).toUpperCase() + c.roast_profile.slice(1) : null, c.roast_level].filter(Boolean).join(' · ')} />
        </div>

        {c.tasting_notes.length > 0 && (
          <section className="flex flex-col gap-2.5">
            <Eyebrow className="text-[10px]">Notas de cata</Eyebrow>
            <div className="flex flex-wrap gap-2">
              {c.tasting_notes.map((n) => (
                <Chip key={n}>{n}</Chip>
              ))}
            </div>
          </section>
        )}

        <section className="flex flex-col gap-3">
          <Eyebrow className="text-[10px]">Lo que dice la comunidad</Eyebrow>
          {logs.length === 0 ? (
            <p className="rounded-2xl bg-card px-4 py-4 text-sm text-muted-foreground">Nadie ha compartido su registro de este café todavía.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {logs.map((l) => (
                <li key={l.id} className="flex gap-3 py-3.5">
                  <span className="size-9 shrink-0 overflow-hidden rounded-full bg-muted">
                    {avatarUrl(l.profile?.avatar_url) ? (
                      <img src={avatarUrl(l.profile?.avatar_url)!} alt="" className="size-full object-cover" />
                    ) : (
                      <span className="flex size-full items-center justify-center text-sm text-muted-foreground">{(l.profile?.display_name ?? '?').charAt(0).toUpperCase()}</span>
                    )}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium">{l.profile?.display_name ?? 'Anónimo'}</span>
                      {l.rating ? <Rating value={l.rating} size="sm" /> : null}
                    </div>
                    {l.notes && <p className="text-sm text-muted-foreground">{l.notes}</p>}
                    {l.brew_method && <span className="text-xs text-tertiary">{l.brew_method}</span>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <Button asChild>
          <Link to="/scan">Escanear este café</Link>
        </Button>
      </div>
    </div>
  )
}

/** Catálogo completo de cafés publicados: /catalog */
export function Catalog() {
  const [items, setItems] = useState<Coffee[] | null>(null)
  useEffect(() => {
    track('catalog_viewed')
    listPublishedCoffees(100).then(setItems).catch(() => setItems([]))
  }, [])
  return (
    <div className="flex flex-col gap-6 px-6 pt-4">
      <header className="flex flex-col gap-1.5">
        <Eyebrow>Inicio</Eyebrow>
        <Title className="text-[34px]">Catálogo</Title>
        <p className="text-sm text-muted-foreground">Cafés de especialidad publicados en Dripo. Toca uno para ver su ficha y lo que opina la comunidad.</p>
      </header>
      {items === null ? (
        <div className="grid grid-cols-2 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[250px] rounded-[20px]" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="rounded-2xl bg-card px-4 py-5 text-sm text-muted-foreground">Aún no hay cafés publicados.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {items.map((c) => (
            <CoffeeCard key={c.id} c={c} className="w-auto" />
          ))}
        </div>
      )}
    </div>
  )
}
