import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { listMyLogs } from '../lib/api'
import { photoUrl } from '../lib/supabase'
import type { CoffeeLog } from '../lib/types'
import { Button, Empty, ErrorBox, Rating, Spinner } from '../components/ui'

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

  return (
    <div className="pt-6">
      <header className="mb-6 flex items-end justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-ink-3">Diario</p>
          <h1 className="font-display text-3xl text-ink">Mis cafés</h1>
        </div>
        {logs && logs.length > 0 && (
          <p className="text-sm text-ink-2">
            {logs.length} {logs.length === 1 ? 'registro' : 'registros'}
          </p>
        )}
      </header>

      <ErrorBox message={error} />

      {!logs && !error && <Spinner label="Cargando tus cafés..." />}

      {logs && logs.length === 0 && (
        <Empty
          title="Todavía no hay cafés"
          body="Escanea la bolsa del café que estás tomando y guarda tu primera nota."
          action={
            <Link to="/scan">
              <Button>Escanear mi primer café</Button>
            </Link>
          }
        />
      )}

      {logs && logs.length > 0 && (
        <ul className="space-y-3">
          {logs.map((log) => (
            <li key={log.id}>
              <LogCard log={log} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function LogCard({ log }: { log: CoffeeLog }) {
  const url = photoUrl(log.photo_path)
  const c = log.coffee
  return (
    <Link
      to={`/log/${log.id}`}
      className="flex gap-3 rounded-2xl border border-line bg-card p-3 transition hover:bg-card-2"
    >
      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-bg-2">
        {url ? (
          <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-ink-3">—</div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium uppercase tracking-wide text-accent">
          {c?.roaster?.name ?? 'Tostador desconocido'}
        </p>
        <p className="truncate font-display text-lg leading-tight text-ink">{c?.name ?? 'Café'}</p>
        <p className="mt-0.5 truncate text-sm text-ink-2">
          {[c?.origin_country, c?.process, c?.variety].filter(Boolean).join(' · ') || 'Sin datos de origen'}
        </p>
        <div className="mt-1.5 flex items-center justify-between">
          <Rating value={log.rating} size="sm" />
          <span className="text-xs text-ink-3">{formatDate(log.consumed_at)}</span>
        </div>
      </div>
    </Link>
  )
}

export function formatDate(iso: string): string {
  const d = new Date(iso + (iso.length === 10 ? 'T12:00:00' : ''))
  return d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })
}
