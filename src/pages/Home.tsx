import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { listMyLogs } from '@/lib/api'
import { photoUrl } from '@/lib/supabase'
import type { CoffeeLog } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Empty, ErrorBox, Eyebrow, Photo, Rating, StatTile, Title } from '@/components/primitives'

type Filter = 'todos' | 'filtro' | 'espresso' | 'favoritos'

export function Home() {
  const { user } = useAuth()
  const [logs, setLogs] = useState<CoffeeLog[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    listMyLogs(user.id)
      .then(setLogs)
      .catch((e) => setError(e.message))
  }, [user])

  return <HomeView logs={logs} error={error} />
}

/** Vista presentacional (Figma 02 · Mis cafés). Recibe datos para poder previsualizarla. */
export function HomeView({ logs, error }: { logs: CoffeeLog[] | null; error: string | null }) {
  const [filter, setFilter] = useState<Filter>('todos')

  const stats = useMemo(() => {
    if (!logs || logs.length === 0) return null
    const origins = new Set(logs.map((l) => l.coffee?.origin_country).filter(Boolean))
    const rated = logs.filter((l) => l.rating != null)
    const avg = rated.length ? rated.reduce((a, l) => a + (l.rating ?? 0), 0) / rated.length : null
    return { count: logs.length, origins: origins.size, avg }
  }, [logs])

  const visible = useMemo(() => {
    if (!logs) return []
    switch (filter) {
      case 'filtro':
        return logs.filter((l) => l.coffee?.roast_profile === 'filtro' || /v60|chemex|kalita|aeropress|prensa/i.test(l.brew_method ?? ''))
      case 'espresso':
        return logs.filter((l) => l.coffee?.roast_profile === 'espresso' || /espresso|moka/i.test(l.brew_method ?? ''))
      case 'favoritos':
        return logs.filter((l) => (l.rating ?? 0) >= 4.5)
      default:
        return logs
    }
  }, [logs, filter])

  return (
    <div>
      <header className="flex flex-col gap-1.5 px-6 pt-4">
        <Eyebrow>Diario</Eyebrow>
        <div className="flex items-end justify-between gap-4">
          <Title className="text-[38px]">Mis cafés</Title>
          {logs && logs.length > 0 && (
            <span className="pb-1 text-[13px] text-muted-foreground">
              {logs.length} {logs.length === 1 ? 'registro' : 'registros'}
            </span>
          )}
        </div>
      </header>

      <div className="px-6 pt-5">
        <ErrorBox message={error} />
      </div>

      {!logs && !error && (
        <div className="flex flex-col gap-4 px-6 pt-4">
          <div className="flex gap-2.5">
            <Skeleton className="h-[76px] flex-1 rounded-2xl" />
            <Skeleton className="h-[76px] flex-1 rounded-2xl" />
            <Skeleton className="h-[76px] flex-1 rounded-2xl" />
          </div>
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3.5 py-3">
              <Skeleton className="size-16 rounded-[14px]" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
          ))}
        </div>
      )}

      {logs && logs.length === 0 && (
        <Empty
          title="Todavía no hay cafés"
          body="Escanea la bolsa del café que estás tomando y guarda tu primera nota."
          action={
            <Button asChild size="sm">
              <Link to="/scan">Escanear mi primer café</Link>
            </Button>
          }
        />
      )}

      {logs && logs.length > 0 && stats && (
        <>
          <div className="flex gap-2.5 px-6 pt-4">
            <StatTile value={String(stats.count)} label="cafés" />
            <StatTile value={String(stats.origins)} label="orígenes" />
            <StatTile value={stats.avg != null ? stats.avg.toFixed(1).replace('.', ',') : '—'} label="promedio" />
          </div>

          <div className="flex gap-2 overflow-x-auto px-6 pt-4 pb-1 [scrollbar-width:none]">
            {(
              [
                ['todos', 'Todos'],
                ['filtro', 'Filtro'],
                ['espresso', 'Espresso'],
                ['favoritos', 'Favoritos'],
              ] as [Filter, string][]
            ).map(([k, l]) => (
              <Chip key={k} active={filter === k} onClick={() => setFilter(k)}>
                {l}
              </Chip>
            ))}
          </div>

          <ul className="px-6 pt-2">
            {visible.map((log, i) => (
              <li key={log.id}>
                <LogRow log={log} />
                {i < visible.length - 1 && <Separator />}
              </li>
            ))}
            {visible.length === 0 && (
              <li className="py-10 text-center text-sm text-muted-foreground">Nada en este filtro todavía.</li>
            )}
          </ul>
        </>
      )}
    </div>
  )
}

function LogRow({ log }: { log: CoffeeLog }) {
  const c = log.coffee
  const meta = [c?.origin_country, c?.process, c?.variety].filter(Boolean).join(' · ')
  return (
    <Link to={`/log/${log.id}`} className="flex items-center gap-3.5 py-4 active:opacity-70">
      <Photo src={photoUrl(log.photo_path)} className="size-16 shrink-0 rounded-[14px]" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="eyebrow truncate text-[10px]">{c?.roaster?.name ?? 'Tostador desconocido'}</span>
        <span className="truncate text-[19px] font-medium leading-tight tracking-[-0.01em]">{c?.name ?? 'Café'}</span>
        <span className="truncate text-xs text-muted-foreground">{meta || 'Sin datos de origen'}</span>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <Rating value={log.rating} size="sm" />
        <span className="text-[11px] text-tertiary">{formatDate(log.consumed_at)}</span>
      </div>
    </Link>
  )
}

export function formatDate(iso: string): string {
  const d = new Date(iso + (iso.length === 10 ? 'T12:00:00' : ''))
  const today = new Date()
  if (d.toDateString() === today.toDateString()) return 'Hoy'
  return d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' }).replace('.', '')
}
