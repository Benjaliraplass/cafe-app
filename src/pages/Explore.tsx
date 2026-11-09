import { useEffect, useState } from 'react'
import { AtSign, ExternalLink, Navigation } from 'lucide-react'
import { listCafes } from '@/lib/api'
import type { Cafe } from '@/lib/types'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Empty, ErrorBox, Eyebrow, Spinner, Title } from '@/components/primitives'

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
    <div>
      <header className="flex flex-col gap-1.5 px-6 pt-4">
        <Eyebrow>Chile</Eyebrow>
        <Title className="text-[38px]">Explorar</Title>
        <p className="pt-1 text-sm text-muted-foreground">Cafeterías y tostadurías de especialidad.</p>
      </header>

      <div className="px-6 pt-5">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre o comuna" />
      </div>

      <div className="px-6 pt-4">
        <ErrorBox message={error} />
        {!cafes && !error && <Spinner label="Cargando lugares..." />}
      </div>

      {cafes && cafes.length === 0 && (
        <Empty title="Estamos armando el mapa" body="Pronto vas a poder explorar cafeterías y tostadurías de especialidad en todo Chile." />
      )}

      {filtered.length > 0 && (
        <ul className="px-6 pt-2">
          {filtered.map((c, i) => (
            <li key={c.id}>
              <div className="flex flex-col gap-1.5 py-4">
                <Eyebrow className="text-[10px]">{KIND_LABEL[c.kind]}</Eyebrow>
                <p className="text-[19px] font-medium leading-tight tracking-[-0.01em]">{c.name}</p>
                <p className="text-sm text-muted-foreground">{[c.address, c.comuna, c.city].filter(Boolean).join(', ')}</p>
                {c.description && <p className="pt-1 text-sm text-muted-foreground">{c.description}</p>}
                <div className="flex gap-4 pt-1.5 text-[13px] font-medium">
                  {c.instagram && (
                    <a className="inline-flex items-center gap-1.5" href={`https://instagram.com/${c.instagram.replace('@', '')}`} target="_blank" rel="noreferrer">
                      <AtSign className="size-3.5" strokeWidth={1.8} /> Instagram
                    </a>
                  )}
                  {c.website && (
                    <a className="inline-flex items-center gap-1.5" href={c.website} target="_blank" rel="noreferrer">
                      <ExternalLink className="size-3.5" strokeWidth={1.8} /> Sitio web
                    </a>
                  )}
                  {c.lat && c.lng && (
                    <a className="inline-flex items-center gap-1.5" href={`https://maps.google.com/?q=${c.lat},${c.lng}`} target="_blank" rel="noreferrer">
                      <Navigation className="size-3.5" strokeWidth={1.8} /> Cómo llegar
                    </a>
                  )}
                </div>
              </div>
              {i < filtered.length - 1 && <Separator />}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
