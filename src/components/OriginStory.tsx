// "De dónde viene" (Lote 16): país, región y finca de un café, generados con IA y guardados en
// origin_notes. Contenedor (lee, genera lo que falta, analítica) + vista presentacional para /preview.
import { useEffect, useRef, useState } from 'react'
import { Lightbulb } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { generateOriginNotes, getOriginNotes, setOriginNoteHidden } from '@/lib/api'
import { track } from '@/lib/analytics'
import type { OriginKind, OriginNote } from '@/lib/types'
import { Eyebrow } from '@/components/primitives'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

type Part = 'place' | 'farm'
type Pending = Record<Part, boolean>

const ORDER: OriginKind[] = ['country', 'region', 'farm']
const LABEL: Record<OriginKind, string> = { country: 'País', region: 'Región', farm: 'Finca' }
const partOf = (k: OriginKind): Part => (k === 'farm' ? 'farm' : 'place')

// Evita generar dos veces lo mismo (StrictMode, volver al detalle mientras corre).
const inflight = new Map<string, Promise<void>>()
function generateOnce(coffeeId: string, part: Part): Promise<void> {
  const k = `${coffeeId}:${part}`
  let p = inflight.get(k)
  if (!p) {
    p = generateOriginNotes(coffeeId, part).finally(() => inflight.delete(k))
    inflight.set(k, p)
  }
  return p
}

export function OriginStory({ coffeeId, where, className }: { coffeeId: string; where: 'detail' | 'public'; className?: string }) {
  const { user, profile } = useAuth()
  const [notes, setNotes] = useState<OriginNote[] | null>(null)
  const [pending, setPending] = useState<Pending>({ place: false, farm: false })
  const tracked = useRef(false)
  const isAdmin = profile?.role === 'admin'

  useEffect(() => {
    let alive = true
    const refresh = () =>
      getOriginNotes(coffeeId).then((rows) => {
        if (alive) setNotes(rows)
        return rows
      })
    refresh()
      .then((rows) => {
        // Sin sesión solo se muestra lo guardado (la función exige JWT).
        if (!user) return
        const missing = new Set(rows.filter((n) => !n.ready).map((n) => partOf(n.kind)))
        for (const part of missing) {
          setPending((p) => ({ ...p, [part]: true }))
          generateOnce(coffeeId, part)
            .then(refresh)
            .catch((e) => console.warn('origin-story', part, e instanceof Error ? e.message : e))
            .finally(() => alive && setPending((p) => ({ ...p, [part]: false })))
        }
      })
      .catch(() => alive && setNotes([]))
    return () => {
      alive = false
    }
  }, [coffeeId, user])

  // Una vez por vista, cuando terminó de cargar y hay algo que mostrar.
  useEffect(() => {
    if (tracked.current || !notes || pending.place || pending.farm) return
    const shown = visibleNotes(notes, false)
    if (shown.length === 0) return
    tracked.current = true
    track('origin_viewed', { where, has_region: shown.some((n) => n.kind === 'region'), has_farm: shown.some((n) => n.kind === 'farm') })
  }, [notes, pending, where])

  if (!notes) return null
  return (
    <OriginStoryView
      notes={notes}
      pending={pending}
      isAdmin={isAdmin}
      className={className}
      onSourceClick={() => track('origin_source_clicked', { where })}
      onToggleHidden={
        isAdmin
          ? async (n) => {
              if (!n.id) return
              await setOriginNoteHidden(n.id, !n.hidden)
              setNotes(await getOriginNotes(coffeeId))
            }
          : undefined
      }
    />
  )
}

function visibleNotes(notes: OriginNote[], isAdmin: boolean): OriginNote[] {
  return ORDER.map((k) => notes.find((n) => n.kind === k)).filter(
    (n): n is OriginNote => !!n && n.ready && n.found !== false && !!n.body && (!n.hidden || isAdmin),
  )
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/** Vista presentacional. No muestra nada si no hay textos ni nada generándose. */
export function OriginStoryView({
  notes,
  pending = { place: false, farm: false },
  isAdmin = false,
  className,
  onSourceClick,
  onToggleHidden,
}: {
  notes: OriginNote[]
  pending?: Pending
  isAdmin?: boolean
  className?: string
  onSourceClick?: () => void
  onToggleHidden?: (n: OriginNote) => Promise<void>
}) {
  const shown = visibleNotes(notes, isAdmin)
  // Bloques que se están generando (todavía sin fila lista).
  const loading = ORDER.filter((k) => pending[partOf(k)] && notes.some((n) => n.kind === k && !n.ready))
  if (shown.length === 0 && loading.length === 0) return null

  const blocks = ORDER.filter((k) => shown.some((n) => n.kind === k) || loading.includes(k))

  return (
    <section className={cn('flex flex-col gap-4', className)}>
      <div className="flex flex-col gap-1">
        <Eyebrow className="text-[10px]">Origen</Eyebrow>
        <h2 className="text-2xl font-medium tracking-[-0.02em]">De dónde viene</h2>
      </div>

      <div className="flex flex-col divide-y divide-border rounded-[20px] bg-card">
        {blocks.map((k) => {
          const n = shown.find((x) => x.kind === k)
          if (!n) return <OriginSkeleton key={k} kind={k} />
          return (
            <article key={k} className={cn('flex flex-col gap-1.5 px-4 py-4', n.hidden && 'opacity-50')}>
              <span className="text-[10px] font-medium uppercase tracking-eyebrow text-tertiary">{LABEL[k]}</span>
              <h3 className="text-[17px] font-medium leading-tight">{n.title}</h3>
              <p className="text-[15px] leading-[1.45] text-muted-foreground">{n.body}</p>
              {n.fun_fact && (
                <p className="mt-1.5 flex gap-2 rounded-xl bg-background px-3 py-2.5 text-[13px] leading-[1.4]">
                  <Lightbulb className="mt-px size-4 shrink-0 text-tertiary" strokeWidth={1.7} />
                  <span>{n.fun_fact}</span>
                </p>
              )}
              {k === 'farm' && n.sources && n.sources.length > 0 && (
                <p className="flex flex-wrap gap-x-2 pt-1 text-xs text-tertiary">
                  <span>{n.sources.length === 1 ? 'Fuente:' : 'Fuentes:'}</span>
                  {n.sources.map((s) => (
                    <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer" onClick={onSourceClick} className="underline underline-offset-2">
                      {hostOf(s.url)}
                    </a>
                  ))}
                </p>
              )}
              {onToggleHidden && (
                <button type="button" onClick={() => onToggleHidden(n)} className="self-start pt-1 text-xs text-tertiary underline underline-offset-2">
                  {n.hidden ? 'Mostrar (admin)' : 'Ocultar (admin)'}
                </button>
              )}
            </article>
          )
        })}
      </div>

      <p className="text-xs text-tertiary">Generado con IA a partir de información pública.</p>
    </section>
  )
}

function OriginSkeleton({ kind }: { kind: OriginKind }) {
  return (
    <div className="flex flex-col gap-2 px-4 py-4" aria-busy="true">
      <span className="text-[10px] font-medium uppercase tracking-eyebrow text-tertiary">{LABEL[kind]}</span>
      {kind === 'farm' && <span className="text-[13px] text-muted-foreground">Buscando información de la finca...</span>}
      <Skeleton className="h-5 w-2/5 rounded-md" />
      <Skeleton className="h-4 w-full rounded-md" />
      <Skeleton className="h-4 w-4/5 rounded-md" />
    </div>
  )
}
