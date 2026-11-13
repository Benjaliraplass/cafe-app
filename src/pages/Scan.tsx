import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Camera, ChevronLeft, Images, PenLine, X } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { track } from '@/lib/analytics'
import { imageToJpegBase64 } from '@/lib/image'
import { saveLog, scanLabel } from '@/lib/api'
import type { ScanResult } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { ErrorBox, Eyebrow, Spinner, Title } from '@/components/primitives'
import { CoffeeLogForm, emptyCoffeeLogForm, formFromScan, formToPayload, mergeScanIntoForm, type CoffeeLogFormState } from '@/components/CoffeeLogForm'
import { cn } from '@/lib/utils'

type Step = 'pick' | 'scanning' | 'review' | 'saving'

/** Foto de la bolsa ya redimensionada. Hasta MAX_PHOTOS por escaneo (frente, dorso, etiqueta extra). */
interface Photo {
  blob: Blob
  base64: string
  preview: string
}
const MAX_PHOTOS = 3

export function Scan() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<Step>('pick')
  const [photos, setPhotos] = useState<Photo[]>([])
  // Índice de la foto que queda como portada del registro (se guarda solo esa).
  const [cover, setCover] = useState(0)
  const [scan, setScan] = useState<ScanResult | null>(null)
  const [form, setForm] = useState<CoffeeLogFormState>(emptyCoffeeLogForm)
  const [error, setError] = useState<string | null>(null)
  const preview = photos[cover]?.preview ?? null

  /** Primera foto: lee y llena el formulario. Siguientes: vuelve a leer con todas y rellena solo lo que falta. */
  async function onFile(file: File | undefined) {
    if (!file || photos.length >= MAX_PHOTOS) return
    setError(null)
    setStep('scanning')
    const startedAt = Date.now()
    const first = photos.length === 0
    track('scan_started', { from: first ? 'photo' : 'extra_photo', photos: photos.length + 1 })
    let next = photos
    try {
      const { base64, blob } = await imageToJpegBase64(file)
      next = [...photos, { blob, base64, preview: URL.createObjectURL(blob) }]
      setPhotos(next)
      const result = await scanLabel(next.map((p) => ({ base64: p.base64 })))
      track('scan_completed', {
        duration_ms: Date.now() - startedAt,
        photos: next.length,
        fields_filled: Object.values(result).filter((v) => v != null && v !== '' && !(Array.isArray(v) && v.length === 0)).length,
      })
      setScan(result)
      setForm((f) => (first ? formFromScan(result) : mergeScanIntoForm(f, result)))
      setStep('review')
    } catch (err) {
      track('scan_failed', { reason: err instanceof Error ? err.message.slice(0, 80) : 'unknown', duration_ms: Date.now() - startedAt })
      setError(err instanceof Error ? err.message : 'No se pudo leer la etiqueta')
      if (first) {
        setScan(null)
        setForm(emptyCoffeeLogForm)
      }
      setStep('review')
    }
  }

  function removePhoto(i: number) {
    const next = photos.filter((_, j) => j !== i)
    setPhotos(next)
    setCover((c) => (c === i ? 0 : c > i ? c - 1 : c))
  }

  function manualEntry() {
    track('scan_started', { from: 'manual' })
    setScan(null)
    setPhotos([])
    setCover(0)
    setForm(emptyCoffeeLogForm)
    setStep('review')
  }

  async function save() {
    if (!user) return
    setError(null)
    setStep('saving')
    try {
      const { coffee, log } = formToPayload(form)
      const blob = photos[cover]?.blob ?? null
      const id = await saveLog({ userId: user.id, photoBlob: blob, scan, coffee, log })
      track('log_saved', { rating: log.rating ?? 0, method: log.brew_method ?? null, from_scan: scan != null, has_photo: blob != null, photos: photos.length })
      navigate(`/log/${id}`, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar')
      setStep('review')
    }
  }

  return (
    <div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          onFile(e.target.files?.[0])
          e.target.value = ''
        }}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          onFile(e.target.files?.[0])
          e.target.value = ''
        }}
      />

      <div className="flex items-center gap-2 px-4 pt-2">
        {step !== 'pick' ? (
          <Button
            variant="secondary"
            size="icon"
            onClick={() => {
              setStep('pick')
              setError(null)
            }}
            aria-label="Volver"
          >
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
          {photos.length > 0 && <img src={photos[photos.length - 1].preview} alt="" className="pulse-soft aspect-[4/3] w-full rounded-[20px] object-cover" />}
          <Spinner label={photos.length > 1 ? `Leyendo las ${photos.length} fotos con IA...` : 'Leyendo la etiqueta con IA...'} />
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
            <div className="px-6 pt-3">
              <img src={preview} alt="" className="aspect-[3/2] w-full rounded-[20px] object-cover" />
            </div>
          )}

          {/* Fotos de la bolsa: miniaturas (toca una para dejarla de portada), quitar, y agregar hasta 3. */}
          {photos.length > 0 && (
            <div className="flex items-center gap-2 px-6 pt-3">
              {photos.map((p, i) => (
                <div key={p.preview} className="relative">
                  <button
                    type="button"
                    onClick={() => setCover(i)}
                    aria-label={i === cover ? 'Portada' : 'Usar como portada'}
                    className={cn('block size-14 overflow-hidden rounded-xl ring-2 ring-offset-2 ring-offset-background', i === cover ? 'ring-foreground' : 'ring-transparent')}
                  >
                    <img src={p.preview} alt="" className="size-full object-cover" />
                  </button>
                  {photos.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removePhoto(i)}
                      aria-label="Quitar foto"
                      className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-foreground text-background"
                    >
                      <X className="size-3" strokeWidth={2.2} />
                    </button>
                  )}
                </div>
              ))}
              {photos.length < MAX_PHOTOS && (
                <>
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="flex size-14 flex-col items-center justify-center rounded-xl bg-card text-muted-foreground"
                    aria-label="Tomar otra foto"
                  >
                    <Camera className="size-5" strokeWidth={1.6} />
                  </button>
                  <button
                    type="button"
                    onClick={() => galleryRef.current?.click()}
                    className="flex size-14 flex-col items-center justify-center rounded-xl bg-card text-muted-foreground"
                    aria-label="Elegir otra foto"
                  >
                    <Images className="size-5" strokeWidth={1.6} />
                  </button>
                  <span className="pl-1 text-[12px] leading-tight text-muted-foreground">
                    ¿Otra etiqueta
                    <br />o el dorso?
                  </span>
                </>
              )}
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

          <CoffeeLogForm form={form} onChange={setForm} />

          <div data-action-bar className="fixed inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-[max(env(safe-area-inset-bottom),12px)]">
            <div className="glass-solid w-full max-w-md rounded-[24px] p-2">
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
