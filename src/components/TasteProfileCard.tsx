import { useState } from 'react'
import { Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { Eyebrow, SectionTitle } from '@/components/primitives'
import {
  ACIDITY_LABEL,
  BODY_LABEL,
  DRINK_LABEL,
  FLAVOR_LABEL,
  FLAVOR_ORDER,
  PROCESS_LABEL,
  ROAST_LABEL,
  emptyTaste,
  isTasteEmpty,
  tasteSummary,
  type Body3,
  type DrinkPref,
  type FlavorFamily,
  type InferredTaste,
  type Level3,
  type ProcessPref,
  type RoastPref,
  type TasteProfile,
} from '@/lib/taste'
import { cn } from '@/lib/utils'

/**
 * "Mi perfil de gusto": resumen (chips) de lo declarado + barras por familia de sabor inferidas
 * del diario, con cuestionario de 6 preguntas para declarar o editar.
 */
export function TasteProfileCard({
  declared,
  inferred,
  onSave,
}: {
  declared: TasteProfile | null
  inferred: InferredTaste
  onSave: (t: TasteProfile) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<TasteProfile>(declared ?? emptyTaste)
  const [saving, setSaving] = useState(false)

  const total = Object.values(inferred.flavors).reduce((a, b) => a + b, 0)

  async function save() {
    setSaving(true)
    try {
      await onSave(draft)
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  if (editing || isTasteEmpty(declared)) {
    if (!editing) {
      return (
        <section className="flex flex-col gap-3">
          <SectionTitle>Mi perfil de gusto</SectionTitle>
          <div className="flex flex-col gap-3 rounded-[20px] bg-card p-4">
            <p className="text-sm text-muted-foreground">Seis preguntas, un minuto. Con esto afinamos las recetas y los cafés que te recomendamos.</p>
            <Button size="sm" onClick={() => setEditing(true)}>
              Contar qué me gusta
            </Button>
          </div>
          {inferred.sample >= 3 && <InferredBars inferred={inferred} total={total} />}
        </section>
      )
    }
    return (
      <section className="flex flex-col gap-5">
        <SectionTitle>Mi perfil de gusto</SectionTitle>
        <Question label="Procesos que te gustan" hint="Puedes marcar varios">
          {(Object.keys(PROCESS_LABEL) as ProcessPref[]).map((k) => {
            const on = draft.processes.includes(k)
            return (
              <Chip key={k} active={on} onClick={() => setDraft({ ...draft, processes: on ? draft.processes.filter((p) => p !== k) : [...draft.processes, k] })}>
                {PROCESS_LABEL[k]}
              </Chip>
            )
          })}
        </Question>
        <Question label="Sabores que buscas" hint="Elige hasta dos">
          {FLAVOR_ORDER.map((k) => {
            const on = draft.flavors.includes(k)
            return (
              <Chip
                key={k}
                active={on}
                onClick={() => setDraft({ ...draft, flavors: on ? draft.flavors.filter((f) => f !== k) : draft.flavors.length < 2 ? [...draft.flavors, k] : [draft.flavors[1], k] })}
              >
                {FLAVOR_LABEL[k]}
              </Chip>
            )
          })}
        </Question>
        <Question label="Acidez">
          {(['baja', 'media', 'alta'] as Level3[]).map((k) => (
            <Chip key={k} active={draft.acidity === k} onClick={() => setDraft({ ...draft, acidity: draft.acidity === k ? null : k })}>
              {k.charAt(0).toUpperCase() + k.slice(1)}
            </Chip>
          ))}
        </Question>
        <Question label="Cuerpo">
          {(['liviano', 'medio', 'intenso'] as Body3[]).map((k) => (
            <Chip key={k} active={draft.body === k} onClick={() => setDraft({ ...draft, body: draft.body === k ? null : k })}>
              {k.charAt(0).toUpperCase() + k.slice(1)}
            </Chip>
          ))}
        </Question>
        <Question label="Tueste">
          {(['claro', 'medio'] as RoastPref[]).map((k) => (
            <Chip key={k} active={draft.roast === k} onClick={() => setDraft({ ...draft, roast: draft.roast === k ? null : k })}>
              {ROAST_LABEL[k].replace('Tueste ', '').replace(/^./, (c) => c.toUpperCase())}
            </Chip>
          ))}
        </Question>
        <Question label="Preparación favorita" hint="Puedes marcar varias">
          {(Object.keys(DRINK_LABEL) as DrinkPref[]).map((k) => {
            const on = draft.drinks.includes(k)
            return (
              <Chip key={k} active={on} onClick={() => setDraft({ ...draft, drinks: on ? draft.drinks.filter((d) => d !== k) : [...draft.drinks, k] })}>
                {DRINK_LABEL[k]}
              </Chip>
            )
          })}
        </Question>
        <div className="flex gap-3">
          {!isTasteEmpty(declared) && (
            <Button variant="outline" className="flex-1" onClick={() => { setDraft(declared ?? emptyTaste); setEditing(false) }}>
              Cancelar
            </Button>
          )}
          <Button className="flex-1" onClick={save} disabled={saving || isTasteEmpty(draft)}>
            {saving ? 'Guardando...' : 'Guardar perfil de gusto'}
          </Button>
        </div>
      </section>
    )
  }

  const t = declared!
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <SectionTitle>Mi perfil de gusto</SectionTitle>
        <Button variant="ghost" size="sm" onClick={() => { setDraft(t); setEditing(true) }}>
          <Pencil className="size-3.5" /> Editar
        </Button>
      </div>
      <div className="flex flex-col gap-4 rounded-[20px] bg-card p-4">
        <div className="flex flex-wrap gap-2">
          {tasteSummary(t).map((s) => (
            <span key={s} className="rounded-full bg-foreground px-3 py-1.5 text-[13px] font-medium text-background">
              {s}
            </span>
          ))}
          {t.roast && <span className="rounded-full border border-border-strong px-3 py-1.5 text-[13px]">{ROAST_LABEL[t.roast]}</span>}
          {t.body && !tasteSummary(t).includes(BODY_LABEL[t.body]) && <span className="rounded-full border border-border-strong px-3 py-1.5 text-[13px]">{BODY_LABEL[t.body]}</span>}
          {t.acidity && !tasteSummary(t).includes(ACIDITY_LABEL[t.acidity]) && <span className="rounded-full border border-border-strong px-3 py-1.5 text-[13px]">{ACIDITY_LABEL[t.acidity]}</span>}
          {t.drinks.length > 0 && <span className="rounded-full border border-border-strong px-3 py-1.5 text-[13px]">{t.drinks.map((d) => DRINK_LABEL[d]).join(' · ')}</span>}
        </div>
        {inferred.sample >= 1 ? (
          <InferredBars inferred={inferred} total={total} embedded />
        ) : (
          <p className="text-xs text-muted-foreground">Cuando puntúes cafés con 4 o 5 estrellas, aquí verás qué sabores se repiten.</p>
        )}
      </div>
    </section>
  )
}

function Question({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline gap-2">
        <Eyebrow className="text-[11px]">{label}</Eyebrow>
        {hint && <span className="text-xs text-tertiary">{hint}</span>}
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  )
}

function InferredBars({ inferred, total, embedded }: { inferred: InferredTaste; total: number; embedded?: boolean }) {
  const max = Math.max(1, ...Object.values(inferred.flavors))
  return (
    <div className={cn('flex flex-col gap-2.5', !embedded && 'rounded-[20px] bg-card p-4')}>
      <Eyebrow className="text-[10px]">
        Según tus {inferred.sample} {inferred.sample === 1 ? 'café mejor puntuado' : 'cafés mejor puntuados'}
      </Eyebrow>
      {total === 0 ? (
        <p className="text-xs text-muted-foreground">Tus cafés favoritos aún no tienen notas de cata registradas.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {FLAVOR_ORDER.filter((f) => inferred.flavors[f] > 0)
            .sort((a, b) => inferred.flavors[b] - inferred.flavors[a])
            .map((f: FlavorFamily) => (
              <li key={f} className="flex items-center gap-3 text-[13px]">
                <span className="w-[118px] shrink-0 text-muted-foreground">{FLAVOR_LABEL[f]}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <span className="block h-full rounded-full bg-foreground" style={{ width: `${(inferred.flavors[f] / max) * 100}%` }} />
                </span>
                <span className="w-5 text-right tabular-nums text-tertiary">{inferred.flavors[f]}</span>
              </li>
            ))}
        </ul>
      )}
    </div>
  )
}
