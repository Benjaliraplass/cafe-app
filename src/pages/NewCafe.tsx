import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Camera, ChevronLeft, MapPin, Search } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { track } from '@/lib/analytics'
import { submitCafe, type NewCafeInput } from '@/lib/api'
import { imageToJpegBase64 } from '@/lib/image'
import { PHOTOS_BUCKET, photoUrl, supabase } from '@/lib/supabase'
import { currentPosition, DEFAULT_CENTER, geocode, type GeocodeHit, type LatLng } from '@/lib/geo'
import type { Cafe } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ErrorBox, Eyebrow, Field, Photo, Title } from '@/components/primitives'
import { PickLocationMap } from '@/components/CafeMap'

const KINDS: { id: Cafe['kind']; label: string }[] = [
  { id: 'cafe', label: 'Cafetería' },
  { id: 'roastery', label: 'Tostaduría' },
  { id: 'both', label: 'Ambas' },
]

export function NewCafe() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)

  const [name, setName] = useState('')
  const [kind, setKind] = useState<Cafe['kind']>('cafe')
  const [addressQuery, setAddressQuery] = useState('')
  const [hits, setHits] = useState<GeocodeHit[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [point, setPoint] = useState<LatLng | null>(null)
  const [address, setAddress] = useState('')
  const [comuna, setComuna] = useState('')
  const [city, setCity] = useState('')
  const [region, setRegion] = useState('')
  const [instagram, setInstagram] = useState('')
  const [website, setWebsite] = useState('')
  const [mapsUrl, setMapsUrl] = useState('')
  const [description, setDescription] = useState('')
  const [photoPath, setPhotoPath] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function search() {
    const q = addressQuery.trim()
    if (q.length < 4) return
    setSearching(true)
    setError(null)
    try {
      const res = await geocode(q)
      setHits(res)
      if (res.length === 0) setError('No encontramos esa dirección. Prueba con calle, número y comuna, o fija el punto en el mapa.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo buscar')
    } finally {
      setSearching(false)
    }
  }

  function pick(h: GeocodeHit) {
    setPoint({ lat: h.lat, lng: h.lng })
    if (!address) setAddress(h.address ?? '')
    if (!comuna && h.comuna) setComuna(h.comuna)
    if (!city && h.city) setCity(h.city)
    if (!region && h.region) setRegion(h.region)
    setHits(null)
  }

  async function useMyLocation() {
    const p = await currentPosition()
    if (p) setPoint(p)
    else setError('No pudimos obtener tu ubicación. Busca la dirección o toca el mapa.')
  }

  async function uploadPhoto(file: File | undefined) {
    if (!file || !user) return
    setUploading(true)
    try {
      const { blob } = await imageToJpegBase64(file, 1280, 0.85)
      const path = `${user.id}/cafes/${Date.now()}.jpg`
      const { error } = await supabase.storage.from(PHOTOS_BUCKET).upload(path, blob, { contentType: 'image/jpeg' })
      if (error) throw new Error(error.message)
      setPhotoPath(path)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo subir la foto')
    } finally {
      setUploading(false)
    }
  }

  async function save() {
    if (!user) return
    if (!name.trim()) return setError('Ponle nombre a la cafetería.')
    if (!point) return setError('Fija la ubicación: busca la dirección o toca el mapa.')
    setSaving(true)
    setError(null)
    try {
      const input: NewCafeInput = {
        name: name.trim(),
        kind,
        address: address.trim() || null,
        comuna: comuna.trim() || null,
        city: city.trim() || null,
        region: region.trim() || null,
        lat: point.lat,
        lng: point.lng,
        instagram: instagram.trim().replace(/^@/, '') || null,
        website: website.trim() || null,
        description: description.trim() || null,
        google_maps_url: mapsUrl.trim() || null,
        photo_path: photoPath,
      }
      await submitCafe(user.id, input)
      track('cafe_proposed', { kind: input.kind, has_maps_url: !!input.google_maps_url })
      navigate('/explore', { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo enviar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      className="flex flex-col gap-5 px-6 pt-2 pb-6"
      onSubmit={(e) => {
        e.preventDefault()
        save()
      }}
    >
      <div className="flex items-center gap-2">
        <Button asChild variant="secondary" size="icon">
          <Link to="/explore" aria-label="Volver">
            <ChevronLeft strokeWidth={1.8} className="size-5" />
          </Link>
        </Button>
        <div className="flex flex-col gap-0.5">
          <Eyebrow className="text-[10px]">Explorar</Eyebrow>
          <Title className="text-[28px]">Sumar cafetería</Title>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">La revisamos antes de publicarla. Solo cafeterías y tostadurías de especialidad.</p>

      <ErrorBox message={error} />

      <Field label="Nombre">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Café Altura" required />
      </Field>

      <div className="flex flex-col gap-2">
        <Eyebrow className="text-[11px]">Tipo</Eyebrow>
        <div className="flex gap-2">
          {KINDS.map((k) => (
            <Chip key={k.id} active={kind === k.id} onClick={() => setKind(k.id)}>
              {k.label}
            </Chip>
          ))}
        </div>
      </div>

      <Field label="Ubicación" hint="Busca la dirección y confirma el punto en el mapa. Puedes arrastrar el marcador.">
        <div className="flex gap-2">
          <Input
            value={addressQuery}
            onChange={(e) => setAddressQuery(e.target.value)}
            placeholder="Calle, número y comuna"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                search()
              }
            }}
          />
          <Button type="button" variant="secondary" size="icon" className="size-12 shrink-0 rounded-xl" onClick={search} disabled={searching} aria-label="Buscar dirección">
            <Search className="size-[18px]" strokeWidth={1.8} />
          </Button>
          <Button type="button" variant="secondary" size="icon" className="size-12 shrink-0 rounded-xl" onClick={useMyLocation} aria-label="Usar mi ubicación">
            <MapPin className="size-[18px]" strokeWidth={1.8} />
          </Button>
        </div>
      </Field>
      {hits && hits.length > 0 && (
        <ul className="-mt-2 flex flex-col divide-y divide-border rounded-2xl border border-border">
          {hits.map((h, i) => (
            <li key={i}>
              <button type="button" onClick={() => pick(h)} className="w-full px-4 py-3 text-left text-sm hover:bg-card">
                {h.label}
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="overflow-hidden rounded-[20px] border border-border">
        <PickLocationMap
          value={point ?? DEFAULT_CENTER}
          onChange={(p) => setPoint(p)}
          className={point ? 'h-[220px] w-full' : 'h-[220px] w-full opacity-60'}
        />
      </div>
      {!point && <p className="-mt-3 text-xs text-muted-foreground">Toca el mapa para fijar el punto si la búsqueda no da con la dirección.</p>}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Dirección" className="col-span-2">
          <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Calle y número" />
        </Field>
        <Field label="Comuna">
          <Input value={comuna} onChange={(e) => setComuna(e.target.value)} placeholder="Providencia" />
        </Field>
        <Field label="Ciudad">
          <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Santiago" />
        </Field>
        <Field label="Instagram">
          <Input value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="@cafealtura" autoCapitalize="none" />
        </Field>
        <Field label="Sitio web">
          <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" inputMode="url" autoCapitalize="none" />
        </Field>
        <Field label="Enlace de Google Maps" hint="Opcional. Compartir desde Google Maps y pegar el enlace; así mostramos fotos y horario." className="col-span-2">
          <Input value={mapsUrl} onChange={(e) => setMapsUrl(e.target.value)} placeholder="https://maps.app.goo.gl/..." inputMode="url" autoCapitalize="none" />
        </Field>
      </div>

      <Field label="Por qué vale la pena" hint="Opcional. Qué la hace especial: tostador propio, métodos, ambiente.">
        <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>

      <div className="flex flex-col gap-2">
        <Eyebrow className="text-[11px]">Foto (opcional)</Eyebrow>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => uploadPhoto(e.target.files?.[0])} />
        <div className="relative">
          <Photo src={photoUrl(photoPath)} className="aspect-[3/2] w-full rounded-[20px]" />
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="absolute right-3 bottom-3 flex items-center gap-1.5 rounded-full bg-background/80 px-3 py-1.5 text-xs font-medium backdrop-blur-md">
            <Camera className="size-3.5" /> {uploading ? 'Subiendo...' : photoPath ? 'Cambiar foto' : 'Agregar foto'}
          </button>
        </div>
      </div>

      <Button type="submit" disabled={saving}>
        {saving ? 'Enviando...' : 'Enviar a revisión'}
      </Button>
    </form>
  )
}
