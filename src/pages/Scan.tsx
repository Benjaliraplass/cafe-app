import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Camera, ChevronLeft, Images, PenLine } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { imageToJpegBase64 } from '@/lib/image'
import { saveLog, scanLabel } from '@/lib/api'
import { BREW_METHODS, type RoastProfile, type ScanResult } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { ErrorBox, Eyebrow, Field, Rating, SectionTitle, Spinner, Title } from '@/components/primitives'

type Step = 'pick' | 'scanning' | 'review' | 'saving'

interface Form {
  roaster_name: string
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
  brew_method: string
  notes: string
  bought_at: string
  price_clp: string
}

const emptyForm: Form = {
  roaster_name: '',
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
  brew_method: '',
  notes: '',
  bought_at: '',
  price_clp: '',
}

export function Scan() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<Step>('pick')
  const [preview, setPreview] = useState<string | null>(null)
  const [blob, setBlob] = useState<Blob | null>(null)
  const [scan, setScan] = useState<ScanResult | null>(null)
  const [form, setForm] = useState<Form>(emptyForm)
  const [error, setError] = useState<string | null>(null)

  function set<K extends keyof Form>(k: K, v: Form[K]) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  async function onFile(file: File | undefined) {
    if (!file) return
    setError(null)
    setStep('scanning')
    try {
      const { base64, blob } = await imageToJpegBase64(file)
      setBlob(blob)
      setPreview(URL.createObjectURL(blob))
      const result = await scanLabel(base64, 'image/jpeg')
      setScan(result)
      setForm({
        ...emptyForm,
        roaster_name: result.roaster_name ?? '',
        name: result.coffee_name ?? '',
        origin_country: result.origin_country ?? '',
        region: result.region ?? '',
        farm: result.farm ?? '',
        producer: result.producer ?? '',
        variety: result.variety ?? '',
        process: result.process ?? '',
        altitude_masl: result.altitude_masl?.toString() ?? '',
        roast_level: result.roast_level ?? '',
        roast_profile: result.roast_profile ?? '',
        tasting_notes: result.tasting_notes.join(', '),
        roast_date: result.roast_date ?? '',
      })
      setStep('review')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo leer la etiqueta')
      setScan(null)
      setForm(emptyForm)
      setStep('review')
    }
  }

  function manualEntry() {
    setScan(null)
    setBlob(null)
    setPreview(null)
    setForm(emptyForm)
    setStep('review')
  }

  async function save() {
    if (!user) return
    setError(null)
    setStep('saving')
    try {
      const id = await saveLog({
        userId: user.id,
        photoBlob: blob,
        scan,
        coffee: {
          roaster_name: form.roaster_name,
          name: form.name,
          origin_country: orNull(form.origin_country),
          region: orNull(form.region),
          farm: orNull(form.farm),
          producer: orNull(form.producer),
          variety: orNull(form.variety),
          process: orNull(form.process),
          altitude_masl: form.altitude_masl ? parseInt(form.altitude_masl, 10) || null : null,
          roast_level: orNull(form.roast_level),
          roast_profile: form.roast_profile || null,
          tasting_notes: form.tasting_notes
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
        },
        log: {
          rating: form.rating,
          notes: orNull(form.notes),
          brew_method: orNull(form.brew_method),
          roast_date: orNull(form.roast_date),
          bought_at: orNull(form.bought_at),
          price_clp: form.price_clp ? parseInt(form.price_clp.replace(/\D/g, ''), 10) || null : null,
        },
      })
      navigate(`/log/${id}`, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar')
      setStep('review')
    }
  }

  const tastingChips = form.tasting_notes
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  return (
    <div>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
      <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />

      {/* Top bar */}
      <div className="flex items-center gap-2 px-4 pt-2">
        {step !== 'pick' ? (
          <Button variant="secondary" size="icon" onClick={() => { setStep('pick'); setError(null) }} aria-label="Volver">
            <ChevronLeft strokeWidth={1.8} className="size-5" />
          </Button>
        ) : (
          <div className="size-10" />
        )}
        <div className="flex flex-col gap-0.5">
          <Eyebrow className="text-[10px]">Nuevo registro</Eyebrow>
          <Title className="text-[28px]">{step === 'pick' ? 'Escanear etiqueta' : 'Confirmar café'}</Title>
        </div>
      </div>

      {step === 'pick' && (
        <div className="flex flex-col gap-3 px-6 pt-8">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex w-full flex-col items-center justify-center gap-3 rounded-[24px] bg-card py-16 text-muted-foreground transition active:scale-[0.99]"
          >
            <span className="flex size-16 items-center justify-center rounded-full bg-background text-foreground">
              <Camera strokeWidth={1.5} className="size-7" />
            </span>
            <span className="text-[15px] font-medium text-foreground">Tomar foto de la bolsa</span>
            <span className="text-sm">Enfoca la etiqueta con buena luz</span>
          </button>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => galleryRef.current?.click()}>
              <Images strokeWidth={1.6} /> Galería
            </Button>
            <Button variant="outline" className="flex-1" onClick={manualEntry}>
              <PenLine strokeWidth={1.6} /> A mano
            </Button>
          </div>
        </div>
      )}

      {step === 'scanning' && (
        <div className="flex flex-col gap-5 px-6 pt-4">
          {preview && <img src={preview} alt="" className="pulse-soft aspect-[4/3] w-full rounded-[20px] object-cover" />}
          <Spinner label="Leyendo la etiqueta con IA..." />
        </div>
      )}

      {(step === 'review' || step === 'saving') && (
        <form
          className="pb-36"
          onSubmit={(e) => {
            e.preventDefault()
            save()
          }}
        >
          {preview && (
            <div className="relative px-6 pt-3">
              <img src={preview} alt="" className="aspect-[3/2] w-full rounded-[20px] object-cover" />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="absolute right-9 bottom-3 rounded-full bg-background/75 px-3 py-1.5 text-xs font-medium backdrop-blur-md"
              >
                Repetir foto
              </button>
            </div>
          )}

          <div className="flex items-start gap-2.5 px-6 pt-3">
            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-foreground" />
            <p className="text-[13px] text-muted-foreground">
              {scan && !scan.is_coffee_label
                ? 'La foto no parece una etiqueta de café. Puedes completar los datos a mano.'
                : scan
                  ? `Etiqueta leída con confianza ${scan.confidence}.${scan.notes_for_user ? ` ${scan.notes_for_user}` : ' Revisa y corrige lo que haga falta.'}`
                  : 'Completa los datos del café a mano.'}
            </p>
          </div>
          <div className="px-6 pt-3">
            <ErrorBox message={error} />
          </div>

          {/* El café */}
          <section className="flex flex-col gap-3.5 px-6 pt-5 pb-6">
            <SectionTitle>El café</SectionTitle>
            <Field label="Tostador">
              <Input value={form.roaster_name} onChange={(e) => set('roaster_name', e.target.value)} placeholder="Ej. Tostado Club" />
            </Field>
            <Field label="Nombre del café">
              <Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Ej. La Pastora" required />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="País">
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

          {/* Mi experiencia */}
          <section className="flex flex-col gap-3.5 px-6 pt-6">
            <SectionTitle>Mi experiencia</SectionTitle>
            <div className="flex flex-col gap-2">
              <Label>Puntaje</Label>
              <Rating value={form.rating} onChange={(v) => set('rating', v)} size="lg" />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Cómo lo preparé</Label>
              <div className="flex flex-wrap gap-2">
                {BREW_METHODS.map((m) => (
                  <Chip key={m} active={form.brew_method === m} onClick={() => set('brew_method', form.brew_method === m ? '' : m)}>
                    {m}
                  </Chip>
                ))}
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

          {/* CTA fijo con blur (Figma 03). z-30 para quedar sobre la barra de navegación. */}
          <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border/80 bg-background/85 backdrop-blur-xl safe-bottom">
            <div className="mx-auto max-w-md px-6 py-4">
              <Button type="submit" className="w-full" disabled={step === 'saving'}>
                {step === 'saving' ? 'Guardando...' : 'Guardar café'}
              </Button>
            </div>
          </div>
        </form>
      )}
    </div>
  )
}

function orNull(s: string): string | null {
  const t = s.trim()
  return t ? t : null
}
