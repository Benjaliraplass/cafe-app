import { useEffect, useState } from 'react'
import { listCafes } from '../lib/api'
import type { Cafe } from '../lib/types'
import { Card, Empty, ErrorBox, Spinner } from '../components/ui'

const KIND_LABEL: Record<Cafe['kind'], string> = {
  cafe: 'Cafetería',
  roastery: 'Tostaduría',
  both: 'Cafetería y tostaduría',
}

export function Explore() {
  const [cafes, setCafes] = useState<Cafe[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState('')

  useEffect(() => {
    listCafes()
      .then(setCafes)
      .catch((e) => setError(e.message))
  }, [])

  const filtered = (cafes ?? []).filter((c) => {
    const s = q.trim().toLowerCase()
    if (!s) return true
    return [c.name, c.comuna, c.city, c.region].some((v) => v?.toLowerCase().includes(s))
  })

  return (
    <div className="pt-6">
      <header className="mb-5">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-3">Chile</p>
        <h1 className="font-display text-3xl text-ink">Explorar</h1>
        <p className="mt-1 text-sm text-ink-2">Cafeterías y tostadurías de especialidad.</p>
      </header>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar por nombre o comuna"
        className="mb-4 w-full rounded-xl border border-line bg-bg-2 px-3.5 py-3 text-base text-ink placeholder:text-ink-3 outline-none focus:border-accent"
      />

      <ErrorBox message={error} />
      {!cafes && !error && <Spinner label="Cargando lugares..." />}

      {cafes && cafes.length === 0 && (
        <Empty
          title="Estamos armando el mapa"
          body="Pronto vas a poder explorar cafeterías y tostadurías de especialidad en todo Chile."
        />
      )}

      {filtered.length > 0 && (
        <ul className="space-y-3">
          {filtered.map((c) => (
            <li key={c.id}>
              <Card>
                <p className="text-xs font-medium uppercase tracking-wide text-accent">{KIND_LABEL[c.kind]}</p>
                <p className="font-display text-lg text-ink">{c.name}</p>
                <p className="text-sm text-ink-2">{[c.address, c.comuna, c.city].filter(Boolean).join(', ')}</p>
                {c.description && <p className="mt-2 text-sm text-ink-2">{c.description}</p>}
                <div className="mt-2 flex gap-3 text-sm">
                  {c.instagram && (
                    <a className="text-accent" href={`https://instagram.com/${c.instagram.replace('@', '')}`} target="_blank" rel="noreferrer">
                      Instagram
                    </a>
                  )}
                  {c.website && (
                    <a className="text-accent" href={c.website} target="_blank" rel="noreferrer">
                      Sitio web
                    </a>
                  )}
                  {c.lat && c.lng && (
                    <a className="text-accent" href={`https://maps.google.com/?q=${c.lat},${c.lng}`} target="_blank" rel="noreferrer">
                      Cómo llegar
                    </a>
                  )}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
