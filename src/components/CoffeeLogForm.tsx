import type { ReactNode } from 'react'
import { BREW_METHODS, CURRENCIES, isPendingLog, type CoffeeLog, type Currency, type RoastProfile, type ScanResult } from '@/lib/types'
import { Chip } from '@/components/ui/chip'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { CountrySelect, Field, Rating, SectionTitle } from '@/components/primitives'

/** Estado del formulario de un café + registro. Compartido por Escanear y Editar. */
export interface CoffeeLogFormState {
  roaster_name: string
  roaster_country: string
  name: string
  origin_country: string
  region: string
  farm: string
  producer: string
  variety: string
  process: string
  altitude_masl: string
  sca_score: string
  roast_level: string
  roast_profile: RoastProfile | ''
  tasting_notes: string
  roast_date: string
  /** false = todavía no lo probó: se guardan solo los datos de compra; puntaje, método y notas quedan pendientes. */
  tasted: boolean
  rating: number | null
  brew_methods: string[]
  notes: string
  bought_at: string
  price_clp: string
  currency: Currency
}

export const emptyCoffeeLogForm: CoffeeLogFormState = {
  roaster_name: '',
  roaster_country: '',
  name: '',
  origin_country: '',
  region: '',
  farm: '',
  producer: '',
  variety: '',
  process: '',
  altitude_masl: '',
  sca_score: '',
  roast_level: '',
  roast_profile: '',
  tasting_notes: '',
  roast_date: '',
  tasted: true,
  rating: null,
  brew_methods: [],
  notes: '',
  bought_at: '',
  price_clp: '',
  currency: rememberedCurrency(),
}

export function formFromScan(r: ScanResult): CoffeeLogFormState {
  return {
    ...emptyCoffeeLogForm,
    roaster_name: r.roaster_name ?? '',
    roaster_country: r.roaster_country ?? '',
    name: r.coffee_name ?? '',
    origin_country: r.origin_country ?? '',
    region: r.region ?? '',
    farm: r.farm ?? '',
    producer: r.producer ?? '',
    variety: r.variety ?? '',
    process: r.process ?? '',
    altitude_masl: r.altitude_masl?.toString() ?? '',
    sca_score: r.sca_score?.toString() ?? '',
    roast_level: r.roast_level ?? '',
    roast_profile: r.roast_profile ?? '',
    tasting_notes: r.tasting_notes.join(', '),
    roast_date: r.roast_date ?? '',
  }
}

/** Segunda lectura (otra foto de la misma bolsa): rellena solo lo que el formulario aún no tiene y suma notas. */
export function mergeScanIntoForm(form: CoffeeLogFormState, r: ScanResult): CoffeeLogFormState {
  const fresh = formFromScan(r)
  const out = { ...form }
  for (const k of Object.keys(fresh) as (keyof CoffeeLogFormState)[]) {
    if (k === 'tasting_notes' || k === 'tasted' || k === 'brew_methods') continue
    const cur = out[k]
    const nxt = fresh[k]
    if (typeof cur === 'string' && typeof nxt === 'string' && !cur.trim() && nxt.trim()) (out as Record<string, unknown>)[k] = nxt
  }
  const notes = new Set(
    [...form.tasting_notes.split(','), ...r.tasting_notes].map((n) => n.trim()).filter(Boolean),
  )
  out.tasting_notes = [...notes].join(', ')
  return out
}

export function formFromLog(log: CoffeeLog): CoffeeLogFormState {
  const c = log.coffee
  return {
    roaster_name: c?.roaster?.name ?? '',
    roaster_country: c?.roaster?.country ?? '',
    name: c?.name ?? '',
    origin_country: c?.origin_country ?? '',
    region: c?.region ?? '',
    farm: c?.farm ?? '',
    producer: c?.producer ?? '',
    variety: c?.variety ?? '',
    process: c?.process ?? '',
    altitude_masl: c?.altitude_masl?.toString() ?? '',
    sca_score: c?.sca_score?.toString() ?? '',
    roast_level: c?.roast_level ?? '',
    roast_profile: c?.roast_profile ?? '',
    tasting_notes: (c?.tasting_notes ?? []).join(', '),
    roast_date: log.roast_date ?? '',
    tasted: !isPendingLog(log),
    rating: log.rating,
    brew_methods: log.brew_method ? log.brew_method.split(',').map((s) => s.trim()).filter(Boolean) : [],
    notes: log.notes ?? '',
    bought_at: log.bought_at ?? '',
    price_clp: log.price_clp?.toString() ?? '',
    currency: log.currency ?? 'CLP',
  }
}

const orNull = (s: string) => (s.trim() ? s.trim() : null)

/** Convierte el formulario a los payloads de coffee y log que usa la API. */
export function formToPayload(form: CoffeeLogFormState) {
  return {
    coffee: {
      roaster_name: form.roaster_name,
      roaster_country: orNull(form.roaster_country),
      name: form.name,
      origin_country: orNull(form.origin_country),
      region: orNull(form.region),
      farm: orNull(form.farm),
      producer: orNull(form.producer),
      variety: orNull(form.variety),
      process: orNull(form.process),
      altitude_masl: form.altitude_masl ? parseInt(form.altitude_masl, 10) || null : null,
      sca_score: parseSca(form.sca_score),
      roast_level: orNull(form.roast_level),
      roast_profile: (form.roast_profile || null) as RoastProfile | null,
      tasting_notes: form.tasting_notes
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    },
    log: {
      rating: form.tasted ? form.rating : null,
      notes: form.tasted ? orNull(form.notes) : null,
      brew_method: form.tasted && form.brew_methods.length ? form.brew_methods.join(', ') : null,
      roast_date: orNull(form.roast_date),
      bought_at: orNull(form.bought_at),
      price_clp: parsePrice(form.price_clp),
      currency: form.currency,
    },
  }
}

export function CoffeeLogForm({
  form,
  onChange,
  beforeExperience,
}: {
  form: CoffeeLogFormState
  onChange: (f: CoffeeLogFormState) => void
  /** Contenido opcional entre las dos secciones (ej. aviso) */
  beforeExperience?: ReactNode
}) {
  function set<K extends keyof CoffeeLogFormState>(k: K, v: CoffeeLogFormState[K]) {
    onChange({ ...form, [k]: v })
  }
  const tastingChips = form.tasting_notes
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  return (
    <>
      <section className="flex flex-col gap-3.5 px-6 pt-5 pb-6">
        <SectionTitle>El café</SectionTitle>
        <div className="grid grid-cols-[1fr_150px] gap-3">
          <Field label="Tostador">
            <Input value={form.roaster_name} onChange={(e) => set('roaster_name', e.target.value)} placeholder="Ej. Tostado Club" />
          </Field>
          <Field label="País tostador">
            <CountrySelect value={form.roaster_country} onChange={(v) => set('roaster_country', v)} placeholder="País" />
          </Field>
        </div>
        <Field label="Nombre del café">
          <Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Ej. La Pastora" required />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="País de origen">
            <Input value={form.origin_country} onChange={(e) => set('origin_country', e.target.value)} placeholder="Colombia" />
          </Field>
          <Field label="Región">
            <Input value={form.region} onChange={(e) => set('region', e.target.value)} placeholder="Huila" />
          </Field>
          <Field label="Variedad">
            <Input value={form.variety} onChange={(e) => set('variety', e.target.value)} placeholder="Caturra" />
          </Field>
          <Field label="Proceso">
            <Input value={form.process} onChange={(e) => set('process', e.target.value)} placeholder="Lavado" />
          </Field>
          <Field label="Altura (msnm)">
            <Input inputMode="numeric" value={form.altitude_masl} onChange={(e) => set('altitude_masl', e.target.value)} placeholder="—" />
          </Field>
          <Field label="Puntaje SCA">
            <Input inputMode="decimal" value={form.sca_score} onChange={(e) => set('sca_score', e.target.value)} placeholder="86.5" />
          </Field>
          <Field label="Fecha de tueste">
            <Input type="date" value={form.roast_date} onChange={(e) => set('roast_date', e.target.value)} />
          </Field>
          <Field label="Finca">
            <Input value={form.farm} onChange={(e) => set('farm', e.target.value)} />
          </Field>
          <Field label="Productor">
            <Input value={form.producer} onChange={(e) => set('producer', e.target.value)} />
          </Field>
        </div>
        <div className="flex flex-col gap-2">
          <Label>Perfil de tueste</Label>
          <div className="flex flex-wrap gap-2">
            {(['filtro', 'espresso', 'omni'] as RoastProfile[]).map((p) => (
              <Chip key={p} active={form.roast_profile === p} onClick={() => set('roast_profile', form.roast_profile === p ? '' : p)}>
                {p === 'filtro' ? 'Filtro' : p === 'espresso' ? 'Espresso' : 'Omni'}
              </Chip>
            ))}
          </div>
        </div>
        <Field label="Notas de cata" hint="Separadas por coma">
          <Input value={form.tasting_notes} onChange={(e) => set('tasting_notes', e.target.value)} placeholder="Chocolate, caramelo, naranja" />
          {tastingChips.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {tastingChips.map((n) => (
                <span key={n} className="rounded-full bg-muted px-3 py-1.5 text-xs">
                  {n}
                </span>
              ))}
            </div>
          )}
        </Field>
      </section>

      <Separator />
      {beforeExperience}

      <section id="experiencia" className="flex flex-col gap-3.5 px-6 pt-6 scroll-mt-4">
        <SectionTitle>Mi experiencia</SectionTitle>
        <div className="flex gap-2">
          <Chip active={form.tasted} onClick={() => set('tasted', true)}>
            Ya lo probé
          </Chip>
          <Chip active={!form.tasted} onClick={() => set('tasted', false)}>
            Todavía no
          </Chip>
        </div>
        {!form.tasted && (
          <p className="text-sm text-muted-foreground">Queda como "por probar". Cuando lo prepares, vuelves y nos cuentas cómo estuvo.</p>
        )}
        {form.tasted && (
        <>
        <div className="flex flex-col gap-2">
          <Label>Puntaje</Label>
          <div className="flex items-center gap-4">
            <Rating value={form.rating} onChange={(v) => set('rating', v === 0 ? null : v)} size="lg" />
            {form.rating != null && (
              <button type="button" onClick={() => set('rating', null)} className="text-xs text-muted-foreground underline-offset-4 hover:underline">
                Quitar
              </button>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Label>Cómo lo preparé</Label>
          <span className="-mt-1 text-xs text-tertiary">Puedes marcar varios</span>
          <div className="flex flex-wrap gap-2">
            {BREW_METHODS.map((m) => {
              const on = form.brew_methods.includes(m)
              return (
                <Chip key={m} active={on} onClick={() => set('brew_methods', on ? form.brew_methods.filter((x) => x !== m) : [...form.brew_methods, m])}>
                  {m}
                </Chip>
              )
            })}
          </div>
        </div>
        <Field label="Notas">
          <Textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Qué sentí, qué cambiaría, con qué lo tomé..." />
        </Field>
        </>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Dónde lo compré">
            <Input value={form.bought_at} onChange={(e) => set('bought_at', e.target.value)} placeholder="Web, cafetería..." />
          </Field>
          <Field label="Precio">
            <div className="flex gap-2">
              <Input
                inputMode="decimal"
                value={form.price_clp}
                onChange={(e) => set('price_clp', e.target.value)}
                placeholder={['CLP', 'COP', 'PYG'].includes(form.currency) ? '12990' : '14,50'}
                className="min-w-0 flex-1"
              />
              <select
                value={form.currency}
                onChange={(e) => {
                  const c = e.target.value as Currency
                  set('currency', c)
                  localStorage.setItem('dripo.currency', c)
                }}
                aria-label="Moneda"
                className="h-12 shrink-0 rounded-xl bg-card px-3 text-[15px]"
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </Field>
        </div>
      </section>
    </>
  )
}

/** Última moneda usada en este dispositivo (quien paga en otra moneda no la elige cada vez). */
function rememberedCurrency(): Currency {
  try {
    const c = localStorage.getItem('dripo.currency')
    return c && (CURRENCIES as readonly string[]).includes(c) ? (c as Currency) : 'CLP'
  } catch {
    return 'CLP'
  }
}

/** Precio: acepta "12.990", "12990", "14,50" o "14.50". Separador de miles solo cuando hay 3 dígitos después. */
function parsePrice(v: string): number | null {
  const t = v.trim().replace(/\s/g, '')
  if (!t) return null
  // "12.990" (miles) -> 12990 ; "14,50" o "14.50" (decimales) -> 14.5
  const normalized = /^\d{1,3}(\.\d{3})+$/.test(t) ? t.replace(/\./g, '') : t.replace(',', '.')
  const n = parseFloat(normalized)
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null
}

/** Puntaje SCA: acepta coma o punto; solo valores plausibles (60-100), con un decimal. */
function parseSca(v: string): number | null {
  const n = parseFloat(v.replace(',', '.'))
  if (!Number.isFinite(n) || n < 60 || n > 100) return null
  return Math.round(n * 10) / 10
}
