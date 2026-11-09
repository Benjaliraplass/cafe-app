import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { imageToJpegBase64 } from '../lib/image'
import { saveLog, scanLabel } from '../lib/api'
import { BREW_METHODS, type RoastProfile, type ScanResult } from '../lib/types'
import { Button, Chip, ErrorBox, Field, Input, Rating, Spinner, Textarea } from '../components/ui'

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
      // Permitimos seguir a mano aunque falle la IA
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

  return (
    <div className="pt-6">
      <header className="mb-6">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-3">Nuevo registro</p>
        <h1 className="font-display text-3xl text-ink">Escanear etiqueta</h1>
      </header>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0])}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0])}
      />

      {step === 'pick' && (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex w-full flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-line bg-card py-16 text-ink-2 transition hover:border-accent hover:text-ink"
          >
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-accent/15 text-accent">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M4 8h3l2-3h6l2 3h3v11H4V8Z" />
                <circle cx="12" cy="13" r="3.5" />
              </svg>
            </span>
            <span className="font-semibold text-ink">Tomar foto de la bolsa</span>
            <span className="text-sm">Enfoca la etiqueta con buena luz</span>
          </button>
          <div className="flex gap-3">
            <Button variant="ghost" className="flex-1" onClick={() => galleryRef.current?.click()}>
              Elegir de la galería
            </Button>
            <Button variant="ghost" className="flex-1" onClick={manualEntry}>
              Ingresar a mano
            </Button>
          </div>
        </div>
      )}

      {step === 'scanning' && (
        <div className="space-y-4">
          {preview && (
            <img src={preview} alt="" className="pulse-soft aspect-square w-full rounded-3xl object-cover" />
          )}
          <Spinner label="Leyendo la etiqueta con IA..." />
        </div>
      )}

      {(step === 'review' || step === 'saving') && (
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault()
            save()
          }}
        >
          {preview && (
            <div className="relative">
              <img src={preview} alt="" className="aspect-[4/3] w-full rounded-3xl object-cover" />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="absolute bottom-3 right-3 rounded-full bg-bg/80 px-3 py-1.5 text-xs font-medium text-ink backdrop-blur"
              >
                Repetir foto
              </button>
            </div>
          )}

          {scan && !scan.is_coffee_label && (
            <p className="rounded-xl border border-warn/40 bg-warn/10 px-3.5 py-3 text-sm text-warn">
              La foto no parece una etiqueta de café. Puedes completar los datos a mano.
            </p>
          )}
          {scan && scan.is_coffee_label && (
            <p className="text-sm text-ink-2">
              Lectura con confianza <span className="font-semibold text-ink">{scan.confidence}</span>.
              {scan.notes_for_user ? ` ${scan.notes_for_user}` : ' Revisa y corrige lo que haga falta.'}
            </p>
          )}
          <ErrorBox message={error} />

          <section className="space-y-3">
            <h2 className="font-display text-xl text-ink">El café</h2>
            <Field label="Tostador">
              <Input value={form.roaster_name} onChange={(e) => set('roaster_name', e.target.value)} placeholder="Ej. Tostado Club" />
            </Field>
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
              <Field label="Finca">
                <Input value={form.farm} onChange={(e) => set('farm', e.target.value)} />
              </Field>
              <Field label="Productor">
                <Input value={form.producer} onChange={(e) => set('producer', e.target.value)} />
              </Field>
              <Field label="Variedad">
                <Input value={form.variety} onChange={(e) => set('variety', e.target.value)} placeholder="Caturra" />
              </Field>
              <Field label="Proceso">
                <Input value={form.process} onChange={(e) => set('process', e.target.value)} placeholder="Lavado" />
              </Field>
              <Field label="Altura (msnm)">
                <Input inputMode="numeric" value={form.altitude_masl} onChange={(e) => set('altitude_masl', e.target.value)} placeholder="1800" />
              </Field>
              <Field label="Nivel de tueste">
                <Input value={form.roast_level} onChange={(e) => set('roast_level', e.target.value)} placeholder="Claro" />
              </Field>
            </div>
            <Field label="Perfil de tueste">
              <div className="flex flex-wrap gap-2">
                {(['filtro', 'espresso', 'omni'] as RoastProfile[]).map((p) => (
                  <Chip key={p} active={form.roast_profile === p} onClick={() => set('roast_profile', form.roast_profile === p ? '' : p)}>
                    {p === 'filtro' ? 'Filtro' : p === 'espresso' ? 'Espresso' : 'Omni'}
                  </Chip>
                ))}
              </div>
            </Field>
            <Field label="Notas de cata" hint="Separadas por coma">
              <Input value={form.tasting_notes} onChange={(e) => set('tasting_notes', e.target.value)} placeholder="Chocolate, caramelo, naranja" />
            </Field>
            <Field label="Fecha de tueste">
              <Input type="date" value={form.roast_date} onChange={(e) => set('roast_date', e.target.value)} />
            </Field>
          </section>

          <section className="space-y-3">
            <h2 className="font-display text-xl text-ink">Mi experiencia</h2>
            <Field label="Puntaje">
              <Rating value={form.rating} onChange={(v) => set('rating', v)} size="lg" />
            </Field>
            <Field label="Cómo lo preparé">
              <div className="flex flex-wrap gap-2">
                {BREW_METHODS.map((m) => (
                  <Chip key={m} active={form.brew_method === m} onClick={() => set('brew_method', form.brew_method === m ? '' : m)}>
                    {m}
                  </Chip>
                ))}
              </div>
            </Field>
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

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => { setStep('pick'); setError(null) }} disabled={step === 'saving'}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" disabled={step === 'saving'}>
              {step === 'saving' ? 'Guardando...' : 'Guardar café'}
            </Button>
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
