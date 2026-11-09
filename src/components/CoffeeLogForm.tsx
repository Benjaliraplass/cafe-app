import type { ReactNode } from 'react'
import { BREW_METHODS, type CoffeeLog, type RoastProfile, type ScanResult } from '@/lib/types'
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
  roast_level: string
  roast_profile: RoastProfile | ''
  tasting_notes: string
  roast_date: string
  rating: number | null
  brew_methods: string[]
  notes: string
  bought_at: string
  price_clp: string
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
  roast_level: '',
  roast_profile: '',
  tasting_notes: '',
  roast_date: '',
  rating: null,
  brew_methods: [],
  notes: '',
  bought_at: '',
  price_clp: '',
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
    roast_level: r.roast_level ?? '',
    roast_profile: r.roast_profile ?? '',
    tasting_notes: r.tasting_notes.join(', '),
    roast_date: r.roast_date ?? '',
  }
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
    roast_level: c?.roast_level ?? '',
    roast_profile: c?.roast_profile ?? '',
    tasting_notes: (c?.tasting_notes ?? []).join(', '),
    roast_date: log.roast_date ?? '',
    rating: log.rating,
    brew_methods: log.brew_method ? log.brew_method.split(',').map((s) => s.trim()).filter(Boolean) : [],
    notes: log.notes ?? '',
    bought_at: log.bought_at ?? '',
    price_clp: log.price_clp?.toString() ?? '',
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
      roast_level: orNull(form.roast_level),
      roast_profile: (form.roast_profile || null) as RoastProfile | null,
      tasting_notes: form.tasting_notes
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    },
    log: {
      rating: form.rating,
      notes: orNull(form.notes),
      brew_method: form.brew_methods.length ? form.brew_methods.join(', ') : null,
      roast_date: orNull(form.roast_date),
      bought_at: orNull(form.bought_at),
      price_clp: form.price_clp ? parseInt(form.price_clp.replace(/\D/g, ''), 10) || null : null,
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

      <section className="flex flex-col gap-3.5 px-6 pt-6">
        <SectionTitle>Mi experiencia</SectionTitle>
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
        <div className="grid grid-cols-2 gap-3">
          <Field label="Dónde lo compré">
            <Input value={form.bought_at} onChange={(e) => set('bought_at', e.target.value)} placeholder="Web, cafetería..." />
          </Field>
          <Field label="Precio (CLP)">
            <Input inputMode="numeric" value={form.price_clp} onChange={(e) => set('price_clp', e.target.value)} placeholder="12990" />
          </Field>
        </div>
      </section>
    </>
  )
}
