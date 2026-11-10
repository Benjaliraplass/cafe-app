import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Clock, LocateFixed, Plus, Search } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { track } from '@/lib/analytics'
import { listCafes, listMyCafes } from '@/lib/api'
import { photoUrl } from '@/lib/supabase'
import { currentPosition, distanceKm, formatDistance, silentPosition, type LatLng } from '@/lib/geo'
import type { Cafe } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { Input } from '@/components/ui/input'
import { Empty, ErrorBox, Eyebrow, Photo, Spinner } from '@/components/primitives'
import { CafeMap, type MapViewport } from '@/components/CafeMap'
import { CafeRow } from '@/components/cards'
import { cn } from '@/lib/utils'


export function Explore() {
  const { user } = useAuth()
  const [cafes, setCafes] = useState<Cafe[] | null>(null)
  const [mine, setMine] = useState<Cafe[]>([])
  const [error, setError] = useState<string | null>(null)
  const [me, setMe] = useState<LatLng | null>(null)

  useEffect(() => {
    listCafes()
      .then(setCafes)
      .catch((e) => setError(e.message))
    if (user) listMyCafes(user.id).then(setMine).catch(() => {})
    silentPosition().then(setMe)
  }, [user])

  return <ExploreView cafes={cafes} mine={mine.filter((c) => c.status !== 'approved')} error={error} me={me} onLocate={async () => setMe(await currentPosition())} />
}

export function ExploreView({
  cafes,
  mine,
  error,
  me,
  onLocate,
}: {
  cafes: Cafe[] | null
  mine: Cafe[]
  error: string | null
  me: LatLng | null
  onLocate: () => Promise<void>
}) {
  const [q, setQ] = useState('')
  const [kind, setKind] = useState<Cafe['kind'] | 'all'>('all')
  const [selected, setSelected] = useState<string | null>(null)
  const [viewport, setViewport] = useState<MapViewport | null>(null)
  const [areaOnly, setAreaOnly] = useState(false)
  const [fit, setFit] = useState<{ points: LatLng[]; key: number } | null>(null)
  const [locating, setLocating] = useState(false)

  // Al obtener la posición por primera vez, encuadrar al usuario junto a las cafeterías más cercanas.
  const flewToUser = useRef(false)
  useEffect(() => {
    if (!me || flewToUser.current || cafes === null) return
    flewToUser.current = true
    const nearest = [...cafes]
      .filter((c) => c.lat != null && c.lng != null)
      .sort((a, b) => dist(a, me) - dist(b, me))
      .slice(0, 3)
      .filter((c) => dist(c, me) < 15)
      .map((c) => ({ lat: c.lat!, lng: c.lng! }))
    setFit({ points: [me, ...nearest], key: Date.now() })
  }, [me, cafes])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    let list = (cafes ?? []).filter((c) => {
      if (kind !== 'all' && c.kind !== kind && c.kind !== 'both') return false
      if (!s) return true
      return [c.name, c.comuna, c.city, c.region, c.address].some((v) => v?.toLowerCase().includes(s))
    })
    if (areaOnly && viewport) list = list.filter((c) => c.lat != null && c.lng != null && viewport.bounds.contains([c.lng, c.lat]))
    // Orden: la seleccionada primero; el resto de más cerca a más lejos (del usuario o del centro del mapa).
    const origin = me ?? viewport?.center ?? null
    list = [...list].sort((a, b) => {
      if (a.id === selected) return -1
      if (b.id === selected) return 1
      return origin ? dist(a, origin) - dist(b, origin) : 0
    })
    return list
  }, [cafes, q, kind, areaOnly, viewport, me, selected])

  function select(id: string | null) {
    setSelected(id)
    if (id) track('cafe_viewed', { cafe_id: id })
  }

  async function locate() {
    setLocating(true)
    await onLocate()
    setLocating(false)
    flewToUser.current = false
  }

  return (
    <div className="-mt-[env(safe-area-inset-top)] flex flex-col">
      {/* Mapa */}
      <div className="relative h-[46vh] min-h-[320px] w-full">
        <CafeMap
          cafes={cafes ?? []}
          selectedId={selected}
          onSelect={select}
          bottomInset={20}
          user={me}
          fitTo={fit}
          onMoveEnd={(v) => setViewport(v)}
          className="absolute inset-0 z-0"
        />
        <div className="pointer-events-none absolute inset-x-0 top-0 z-[400] flex items-start justify-end px-4 pt-[calc(env(safe-area-inset-top)+12px)]">
          <div className="pointer-events-auto flex flex-col gap-2">
            <Button variant="secondary" size="icon" className="glass bg-transparent" onClick={locate} aria-label="Mi ubicación" disabled={locating}>
              <LocateFixed className={cn('size-[18px]', locating && 'animate-pulse')} strokeWidth={1.8} />
            </Button>
          </div>
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-6 z-[400] flex justify-center">
          <button
            type="button"
            onClick={() => setAreaOnly((v) => !v)}
            className={cn(
              'pointer-events-auto rounded-full px-4 py-2 text-[13px] font-medium shadow-[0_8px_20px_-8px_rgba(0,0,0,0.4)] transition-colors',
              areaOnly ? 'bg-foreground text-background' : 'glass',
            )}
          >
            {areaOnly ? 'Mostrando esta zona' : 'Buscar en esta zona'}
          </button>
        </div>
      </div>

      {/* Panel */}
      <div className="relative z-10 -mt-5 flex flex-col gap-4 rounded-t-[28px] bg-background px-6 pt-3 pb-6 shadow-[0_-8px_24px_-16px_rgba(0,0,0,0.25)]">
        <div className="mx-auto h-1 w-10 rounded-full bg-border-strong" />
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-tertiary" strokeWidth={1.8} />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nombre, comuna o ciudad" className="pl-10" />
          </div>
          <Button asChild size="icon" className="size-12 rounded-xl" aria-label="Sumar cafetería">
            <Link to="/explore/new">
              <Plus className="size-5" strokeWidth={1.8} />
            </Link>
          </Button>
        </div>
        <div className="flex gap-2">
          {(['all', 'cafe', 'roastery'] as const).map((k) => (
            <Chip key={k} active={kind === k} onClick={() => setKind(k)}>
              {k === 'all' ? 'Todo' : k === 'cafe' ? 'Cafeterías' : 'Tostadurías'}
            </Chip>
          ))}
        </div>

        <ErrorBox message={error} />
        {!cafes && !error && <Spinner label="Cargando lugares..." />}

        {cafes && cafes.length === 0 && mine.length === 0 && (
          <Empty
            title="Estamos armando el mapa"
            body="Sé el primero en sumar una cafetería o tostaduría de especialidad. La revisamos y la publicamos."
            action={
              <Button asChild size="sm">
                <Link to="/explore/new">Sumar cafetería</Link>
              </Button>
            }
          />
        )}

        {cafes && cafes.length > 0 && filtered.length === 0 && (
          <p className="rounded-2xl bg-card px-4 py-4 text-sm text-muted-foreground">Nada por aquí con esos filtros. Prueba ampliar la zona del mapa.</p>
        )}

        {filtered.length > 0 && (
          <ul className="flex flex-col divide-y divide-border">
            {filtered.map((c) => (
              <CafeRow key={c.id} c={c} active={c.id === selected} onClick={() => select(c.id)} distance={me && c.lat != null && c.lng != null ? formatDistance(distanceKm(me, { lat: c.lat, lng: c.lng })) : null} />
            ))}
          </ul>
        )}

        {mine.length > 0 && (
          <section className="flex flex-col gap-2 pt-2">
            <Eyebrow className="text-[10px]">Mis propuestas</Eyebrow>
            <ul className="flex flex-col divide-y divide-border">
              {mine.map((c) => (
                <li key={c.id} className="flex items-center gap-3 py-3">
                  <Photo src={photoUrl(c.photo_path)} className="size-12 shrink-0 rounded-xl" />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[15px] font-medium">{c.name}</span>
                    <span className="truncate text-xs text-muted-foreground">{[c.comuna, c.city].filter(Boolean).join(', ')}</span>
                    {c.status === 'rejected' && c.rejection_reason && <span className="text-xs text-destructive">Rechazada: {c.rejection_reason}</span>}
                  </div>
                  <span className={cn('flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium', c.status === 'pending' ? 'bg-muted text-muted-foreground' : 'bg-destructive/10 text-destructive')}>
                    <Clock className="size-3" /> {c.status === 'pending' ? 'En revisión' : 'Rechazada'}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  )
}

function dist(c: Cafe, o: LatLng): number {
  return c.lat != null && c.lng != null ? distanceKm(o, { lat: c.lat, lng: c.lng }) : Number.POSITIVE_INFINITY
}
