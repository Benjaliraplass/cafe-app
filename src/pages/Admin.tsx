import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Camera, Pencil, Plus, Trash2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import {
  deleteFeaturedRecipe,
  listFeaturedRecipes,
  listMyLogs,
  listPendingCafes,
  listPublishedCoffees,
  moderateCafe,
  setCoffeePublished,
  slugify,
  upsertFeaturedRecipe,
  type FeaturedRecipeInput,
} from '@/lib/api'
import { imageToJpegBase64 } from '@/lib/image'
import { PHOTOS_BUCKET, photoUrl, supabase } from '@/lib/supabase'
import { METHOD_FAMILIES, type Cafe, type Coffee, type CoffeeLog, type FeaturedAuthorRole, type FeaturedRecipe, type MethodFamily } from '@/lib/types'
import { directionsUrl, instagramUrl } from '@/lib/geo'
import { AtSign, Navigation } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { CountrySelect, ErrorBox, Eyebrow, Field, Photo, SectionTitle, Spinner, Title } from '@/components/primitives'

type Tab = 'recetas' | 'cafes' | 'cafeterias'

export function Admin() {
  const { user, profile, isAdmin } = useAuth()
  const [tab, setTab] = useState<Tab>('recetas')
  if (!user) return null
  // El perfil puede estar cargando; no redirigir hasta saber el rol.
  if (profile && !isAdmin) return <Navigate to="/" replace />
  if (!profile) {
    return (
      <div className="px-6 pt-8">
        <Spinner label="Cargando..." />
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-6 px-6 pt-4 pb-6">
      <header className="flex flex-col gap-1.5">
        <Eyebrow>Solo admin</Eyebrow>
        <Title className="text-[34px]">Administración</Title>
      </header>
      <div className="flex gap-2">
        <Chip active={tab === 'recetas'} onClick={() => setTab('recetas')}>
          Recetas destacadas
        </Chip>
        <Chip active={tab === 'cafes'} onClick={() => setTab('cafes')}>
          Catálogo de cafés
        </Chip>
        <Chip active={tab === 'cafeterias'} onClick={() => setTab('cafeterias')}>
          Cafeterías
        </Chip>
      </div>
      {tab === 'recetas' && <FeaturedAdmin userId={user.id} />}
      {tab === 'cafes' && <CatalogAdmin userId={user.id} />}
      {tab === 'cafeterias' && <CafesAdmin userId={user.id} />}
    </div>
  )
}

// ---------------- Recetas destacadas ----------------

interface FormState {
  id?: string
  title: string
  author: string
  author_role: FeaturedAuthorRole
  country: string
  event: string
  method_family: MethodFamily
  dripper: string
  dose_g: string
  water_g: string
  ratio: string
  water_temp_c: string
  grind: string
  grind_reference: string
  total_time: string
  yield_g: string
  pressure_bar: string
  steps: string
  story: string
  source_url: string
  photo_path: string | null
  is_published: boolean
  sort_order: string
}

const emptyForm: FormState = {
  title: '',
  author: '',
  author_role: 'otro',
  country: '',
  event: '',
  method_family: 'conico',
  dripper: 'V60',
  dose_g: '',
  water_g: '',
  ratio: '',
  water_temp_c: '',
  grind: '',
  grind_reference: '',
  total_time: '',
  yield_g: '',
  pressure_bar: '',
  steps: '',
  story: '',
  source_url: '',
  photo_path: null,
  is_published: false,
  sort_order: '100',
}

function formFromRecipe(r: FeaturedRecipe): FormState {
  const p = r.params
  return {
    id: r.id,
    title: r.title,
    author: r.author,
    author_role: r.author_role,
    country: r.country ?? '',
    event: r.event ?? '',
    method_family: r.method_family,
    dripper: r.dripper,
    dose_g: p.dose_g?.toString() ?? '',
    water_g: p.water_g?.toString() ?? '',
    ratio: p.ratio ?? '',
    water_temp_c: p.water_temp_c?.toString() ?? '',
    grind: p.grind ?? '',
    grind_reference: p.grind_reference ?? '',
    total_time: p.total_time ?? '',
    yield_g: p.yield_g?.toString() ?? '',
    pressure_bar: p.pressure_bar?.toString() ?? '',
    steps: r.steps.map((s) => `${s.time} ${s.action}`).join('\n'),
    story: r.story ?? '',
    source_url: r.source_url ?? '',
    photo_path: r.photo_path,
    is_published: r.is_published,
    sort_order: String(r.sort_order),
  }
}

function num(s: string): number | null {
  const n = Number(s.replace(',', '.'))
  return s.trim() && Number.isFinite(n) ? n : null
}

function formToInput(f: FormState, existingSlug?: string): FeaturedRecipeInput {
  const steps = f.steps
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const m = l.match(/^(\d{1,2}:\d{2})\s+(.*)$/)
      return m ? { time: m[1], action: m[2] } : { time: '', action: l }
    })
  return {
    id: f.id,
    slug: existingSlug ?? slugify(f.title),
    title: f.title.trim(),
    author: f.author.trim(),
    author_role: f.author_role,
    country: f.country || null,
    event: f.event.trim() || null,
    method_family: f.method_family,
    dripper: f.dripper.trim(),
    params: {
      dose_g: num(f.dose_g) ?? undefined,
      water_g: num(f.water_g),
      ratio: f.ratio.trim() || undefined,
      water_temp_c: num(f.water_temp_c) ?? undefined,
      grind: f.grind.trim() || undefined,
      grind_reference: f.grind_reference.trim() || null,
      total_time: f.total_time.trim() || undefined,
      yield_g: num(f.yield_g),
      pressure_bar: num(f.pressure_bar),
    },
    steps,
    story: f.story.trim() || null,
    source_url: f.source_url.trim() || null,
    photo_path: f.photo_path,
    is_published: f.is_published,
    sort_order: Number(f.sort_order) || 100,
  }
}

function FeaturedAdmin({ userId }: { userId: string }) {
  const [items, setItems] = useState<FeaturedRecipe[] | null>(null)
  const [editing, setEditing] = useState<FormState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const load = () => listFeaturedRecipes({ includeDrafts: true }).then(setItems).catch((e) => setError(e.message))
  useEffect(() => {
    load()
  }, [])

  async function save() {
    if (!editing) return
    setSaving(true)
    setError(null)
    try {
      const existing = editing.id ? items?.find((i) => i.id === editing.id) : undefined
      await upsertFeaturedRecipe(userId, formToInput(editing, existing?.slug))
      setEditing(null)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  async function remove(r: FeaturedRecipe) {
    if (!confirm(`¿Eliminar "${r.title}"?`)) return
    try {
      await deleteFeaturedRecipe(r.id)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo eliminar')
    }
  }

  async function uploadPhoto(file: File | undefined) {
    if (!file || !editing) return
    setUploading(true)
    try {
      const { blob } = await imageToJpegBase64(file, 1280, 0.85)
      const path = `${userId}/featured/${Date.now()}.jpg`
      const { error } = await supabase.storage.from(PHOTOS_BUCKET).upload(path, blob, { contentType: 'image/jpeg' })
      if (error) throw new Error(error.message)
      setEditing({ ...editing, photo_path: path })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo subir la foto')
    } finally {
      setUploading(false)
    }
  }

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setEditing((f) => (f ? { ...f, [k]: v } : f))
  }

  if (editing) {
    const isEspresso = editing.method_family === 'espresso'
    return (
      <section className="flex flex-col gap-4">
        <SectionTitle>{editing.id ? 'Editar receta' : 'Nueva receta destacada'}</SectionTitle>
        <ErrorBox message={error} />
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => uploadPhoto(e.target.files?.[0])} />
        <div className="relative">
          <Photo src={photoUrl(editing.photo_path)} className="aspect-[4/3] w-full rounded-[20px]" />
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="absolute right-3 bottom-3 flex items-center gap-1.5 rounded-full bg-background/80 px-3 py-1.5 text-xs font-medium backdrop-blur-md">
            <Camera className="size-3.5" /> {uploading ? 'Subiendo...' : editing.photo_path ? 'Cambiar foto' : 'Agregar foto'}
          </button>
        </div>
        <Field label="Título">
          <Input value={editing.title} onChange={(e) => set('title', e.target.value)} placeholder="Ej. V60 método 4:6" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Autor">
            <Input value={editing.author} onChange={(e) => set('author', e.target.value)} placeholder="Tetsu Kasuya" />
          </Field>
          <Field label="Rol">
            <Select value={editing.author_role} onChange={(e) => set('author_role', e.target.value as FeaturedAuthorRole)}>
              <option value="campeon">Campeón</option>
              <option value="tostador">Tostador</option>
              <option value="barista">Barista</option>
              <option value="otro">Otro</option>
            </Select>
          </Field>
          <Field label="País">
            <CountrySelect value={editing.country} onChange={(v) => set('country', v)} placeholder="País" />
          </Field>
          <Field label="Evento">
            <Input value={editing.event} onChange={(e) => set('event', e.target.value)} placeholder="WBrC 2016" />
          </Field>
          <Field label="Familia">
            <Select value={editing.method_family} onChange={(e) => set('method_family', e.target.value as MethodFamily)}>
              {METHOD_FAMILIES.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Dripper">
            <Input value={editing.dripper} onChange={(e) => set('dripper', e.target.value)} placeholder="V60" />
          </Field>
        </div>

        <Eyebrow className="text-[11px]">Parámetros</Eyebrow>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Dosis (g)">
            <Input inputMode="decimal" value={editing.dose_g} onChange={(e) => set('dose_g', e.target.value)} />
          </Field>
          {isEspresso ? (
            <Field label="Salida (g)">
              <Input inputMode="decimal" value={editing.yield_g} onChange={(e) => set('yield_g', e.target.value)} />
            </Field>
          ) : (
            <Field label="Agua (g)">
              <Input inputMode="decimal" value={editing.water_g} onChange={(e) => set('water_g', e.target.value)} />
            </Field>
          )}
          <Field label="Ratio">
            <Input value={editing.ratio} onChange={(e) => set('ratio', e.target.value)} placeholder="1:15" />
          </Field>
          <Field label="Temp. (°C)">
            <Input inputMode="decimal" value={editing.water_temp_c} onChange={(e) => set('water_temp_c', e.target.value)} />
          </Field>
          <Field label="Tiempo">
            <Input value={editing.total_time} onChange={(e) => set('total_time', e.target.value)} placeholder="3:30" />
          </Field>
          {isEspresso ? (
            <Field label="Presión (bar)">
              <Input inputMode="decimal" value={editing.pressure_bar} onChange={(e) => set('pressure_bar', e.target.value)} />
            </Field>
          ) : (
            <Field label="Molienda">
              <Input value={editing.grind} onChange={(e) => set('grind', e.target.value)} placeholder="Media gruesa" />
            </Field>
          )}
        </div>
        {isEspresso && (
          <Field label="Molienda">
            <Input value={editing.grind} onChange={(e) => set('grind', e.target.value)} placeholder="Fina" />
          </Field>
        )}
        <Field label="Referencia de molienda" hint="Opcional. Ej. 24 clics en Comandante C40">
          <Input value={editing.grind_reference} onChange={(e) => set('grind_reference', e.target.value)} />
        </Field>
        <Field label="Pasos" hint="Uno por línea, empezando con el tiempo. Ej. 0:00 Vierte 60 g y espera.">
          <Textarea rows={7} value={editing.steps} onChange={(e) => set('steps', e.target.value)} />
        </Field>
        <Field label="Por qué funciona" hint="Historia y lógica de la receta, en nuestras palabras (no copiar textos).">
          <Textarea rows={5} value={editing.story} onChange={(e) => set('story', e.target.value)} />
        </Field>
        <Field label="Fuente (URL)">
          <Input value={editing.source_url} onChange={(e) => set('source_url', e.target.value)} placeholder="https://" inputMode="url" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Orden">
            <Input inputMode="numeric" value={editing.sort_order} onChange={(e) => set('sort_order', e.target.value)} />
          </Field>
          <Field label="Estado">
            <Select value={editing.is_published ? '1' : '0'} onChange={(e) => set('is_published', e.target.value === '1')}>
              <option value="0">Borrador</option>
              <option value="1">Publicada</option>
            </Select>
          </Field>
        </div>
        <div className="flex gap-3 pt-2">
          <Button variant="outline" className="flex-1" onClick={() => setEditing(null)}>
            Cancelar
          </Button>
          <Button className="flex-1" onClick={save} disabled={saving || !editing.title.trim() || !editing.author.trim() || !editing.dripper.trim()}>
            {saving ? 'Guardando...' : 'Guardar'}
          </Button>
        </div>
      </section>
    )
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <SectionTitle>Recetas destacadas</SectionTitle>
        <Button size="sm" onClick={() => setEditing({ ...emptyForm })}>
          <Plus className="size-4" /> Nueva
        </Button>
      </div>
      <ErrorBox message={error} />
      {items === null ? (
        <Spinner />
      ) : items.length === 0 ? (
        <p className="rounded-2xl bg-card px-4 py-5 text-sm text-muted-foreground">Sin recetas todavía.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {items.map((r) => (
            <li key={r.id} className="flex items-center gap-3 py-3">
              <Photo src={photoUrl(r.photo_path)} className="size-14 shrink-0 rounded-xl" />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[15px] font-medium">{r.title}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {r.author} · {r.dripper} · {r.is_published ? 'Publicada' : 'Borrador'} · orden {r.sort_order}
                </span>
                <Link to={`/r/${r.slug}`} className="text-xs text-tertiary underline-offset-4 hover:underline">
                  /r/{r.slug}
                </Link>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setEditing(formFromRecipe(r))} aria-label="Editar">
                <Pencil className="size-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => remove(r)} aria-label="Eliminar">
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

// ---------------- Catálogo de cafés ----------------

function CatalogAdmin({ userId }: { userId: string }) {
  const [logs, setLogs] = useState<CoffeeLog[] | null>(null)
  const [published, setPublished] = useState<Coffee[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const load = () =>
    Promise.all([listMyLogs(userId), listPublishedCoffees(200)])
      .then(([l, p]) => {
        setLogs(l)
        setPublished(p)
      })
      .catch((e) => setError(e.message))
  useEffect(() => {
    load()
  }, [userId])

  // Cafés de mis registros que aún no están publicados (uno por café)
  const candidates = useMemo(() => {
    if (!logs) return []
    const seen = new Set<string>()
    const out: { coffee: Coffee; log: CoffeeLog }[] = []
    for (const l of logs) {
      if (!l.coffee || seen.has(l.coffee.id) || l.coffee.is_published) continue
      seen.add(l.coffee.id)
      out.push({ coffee: l.coffee, log: l })
    }
    return out
  }, [logs])

  async function publish(coffee: Coffee, photo: string | null) {
    setBusy(coffee.id)
    setError(null)
    try {
      await setCoffeePublished(coffee.id, true, coffee.photo_path ?? photo)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo publicar')
    } finally {
      setBusy(null)
    }
  }
  async function unpublish(coffee: Coffee) {
    setBusy(coffee.id)
    setError(null)
    try {
      await setCoffeePublished(coffee.id, false)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo despublicar')
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="flex flex-col gap-6">
      <ErrorBox message={error} />
      <div className="flex flex-col gap-3">
        <SectionTitle>Por publicar</SectionTitle>
        <p className="text-sm text-muted-foreground">Cafés de tus registros que todavía no están en el catálogo. Al publicar se usa la foto de tu registro.</p>
        {logs === null ? (
          <Spinner />
        ) : candidates.length === 0 ? (
          <p className="rounded-2xl bg-card px-4 py-4 text-sm text-muted-foreground">Todo lo que escaneaste ya está publicado.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {candidates.map(({ coffee, log }) => (
              <li key={coffee.id} className="flex items-center gap-3 py-3">
                <Photo src={photoUrl(log.photo_path)} className="size-14 shrink-0 rounded-xl" />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[15px] font-medium">{coffee.name}</span>
                  <span className="truncate text-xs text-muted-foreground">{[coffee.roaster?.name, coffee.origin_country, coffee.process].filter(Boolean).join(' · ')}</span>
                </div>
                <Button size="sm" onClick={() => publish(coffee, log.photo_path)} disabled={busy === coffee.id}>
                  Publicar
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <SectionTitle>Publicados ({published?.length ?? 0})</SectionTitle>
        {published === null ? (
          <Spinner />
        ) : published.length === 0 ? (
          <p className="rounded-2xl bg-card px-4 py-4 text-sm text-muted-foreground">Nada publicado todavía.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {published.map((c) => (
              <li key={c.id} className="flex items-center gap-3 py-3">
                <Photo src={photoUrl(c.photo_path)} className="size-14 shrink-0 rounded-xl" />
                <div className="flex min-w-0 flex-1 flex-col">
                  <Link to={`/c/${c.id}`} className="truncate text-[15px] font-medium">
                    {c.name}
                  </Link>
                  <span className="truncate text-xs text-muted-foreground">{[c.roaster?.name, c.origin_country, c.process].filter(Boolean).join(' · ')}</span>
                </div>
                <Button size="sm" variant="outline" onClick={() => unpublish(c)} disabled={busy === c.id}>
                  Quitar
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

// ---------------- Moderación de cafeterías ----------------

function CafesAdmin({ userId }: { userId: string }) {
  const [pending, setPending] = useState<Cafe[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const load = () => listPendingCafes().then(setPending).catch((e) => setError(e.message))
  useEffect(() => {
    load()
  }, [])

  async function decide(c: Cafe, decision: 'approved' | 'rejected') {
    let reason: string | undefined
    if (decision === 'rejected') {
      const r = prompt('Motivo del rechazo (lo verá quien la propuso):', 'No es una cafetería de especialidad')
      if (r === null) return
      reason = r.trim() || undefined
    }
    setBusy(c.id)
    setError(null)
    try {
      await moderateCafe(userId, c.id, decision, reason)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar')
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <SectionTitle>Por revisar ({pending?.length ?? 0})</SectionTitle>
        <p className="text-sm text-muted-foreground">Cafeterías propuestas por usuarios. Al aprobar aparecen en el mapa de inmediato.</p>
      </div>
      <ErrorBox message={error} />
      {pending === null ? (
        <Spinner />
      ) : pending.length === 0 ? (
        <p className="rounded-2xl bg-card px-4 py-4 text-sm text-muted-foreground">Nada pendiente.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {pending.map((c) => (
            <li key={c.id} className="flex flex-col gap-3 rounded-[20px] bg-card p-3">
              <div className="flex gap-3">
                <Photo src={photoUrl(c.photo_path)} className="size-[72px] shrink-0 rounded-[14px]" />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="eyebrow text-[10px]">{c.kind === 'cafe' ? 'Cafetería' : c.kind === 'roastery' ? 'Tostaduría' : 'Cafetería y tostaduría'}</span>
                  <span className="text-[17px] font-medium leading-tight">{c.name}</span>
                  <span className="text-sm text-muted-foreground">{[c.address, c.comuna, c.city].filter(Boolean).join(', ')}</span>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-[13px]">
                    {(c.google_maps_url || (c.lat != null && c.lng != null)) && (
                      <a href={c.google_maps_url ?? directionsUrl({ lat: c.lat!, lng: c.lng! })} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 underline-offset-4 hover:underline">
                        <Navigation className="size-3.5" /> {c.google_maps_url ? 'Ficha en Google Maps' : 'Ver en el mapa'}
                      </a>
                    )}
                    {c.instagram && (
                      <a href={instagramUrl(c.instagram)} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-muted-foreground underline-offset-4 hover:underline">
                        <AtSign className="size-3.5" /> {c.instagram}
                      </a>
                    )}
                  </div>
                </div>
              </div>
              {c.description && <p className="text-sm text-muted-foreground">{c.description}</p>}
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => decide(c, 'rejected')} disabled={busy === c.id}>
                  Rechazar
                </Button>
                <Button size="sm" className="flex-1" onClick={() => decide(c, 'approved')} disabled={busy === c.id}>
                  Aprobar
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
