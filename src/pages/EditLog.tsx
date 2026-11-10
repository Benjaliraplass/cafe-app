import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { imageToJpegBase64 } from '@/lib/image'
import { getLog, updateLog } from '@/lib/api'
import { photoUrl } from '@/lib/supabase'
import type { CoffeeLog } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { ErrorBox, Eyebrow, Photo, Spinner, Title } from '@/components/primitives'
import { CoffeeLogForm, formFromLog, formToPayload, type CoffeeLogFormState } from '@/components/CoffeeLogForm'

export function EditLog({ previewLog }: { previewLog?: CoffeeLog } = {}) {
  const params = useParams<{ id: string }>()
  const id = previewLog?.id ?? params.id
  const { user } = useAuth()
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)

  const [log, setLog] = useState<CoffeeLog | null | undefined>(previewLog)
  const [form, setForm] = useState<CoffeeLogFormState | null>(previewLog ? formFromLog(previewLog) : null)
  const [preview, setPreview] = useState<string | null>(null)
  const [blob, setBlob] = useState<Blob | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id || previewLog) return
    getLog(id)
      .then((l) => {
        setLog(l)
        if (l) setForm(formFromLog(l))
      })
      .catch((e) => setError(e.message))
  }, [id, previewLog])

  async function onFile(file: File | undefined) {
    if (!file) return
    try {
      const { blob } = await imageToJpegBase64(file)
      setBlob(blob)
      setPreview(URL.createObjectURL(blob))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo leer la imagen')
    }
  }

  async function save() {
    if (!user || !log || !form) return
    setSaving(true)
    setError(null)
    try {
      const { coffee, log: logFields } = formToPayload(form)
      await updateLog({ userId: user.id, log, photoBlob: blob, coffee, logFields })
      navigate(`/log/${log.id}`, { replace: true })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  if (log === undefined) {
    return (
      <div className="px-6 pt-8">
        <Spinner label="Cargando..." />
      </div>
    )
  }
  if (log === null || !form) {
    return (
      <div className="px-6 pt-8">
        <p className="text-muted-foreground">No encontramos este registro.</p>
        <Link to="/logs" className="mt-4 inline-block underline underline-offset-4">
          Volver a mis cafés
        </Link>
      </div>
    )
  }

  const currentPhoto = preview ?? photoUrl(log.photo_path)

  return (
    <form
      className="pb-36"
      onSubmit={(e) => {
        e.preventDefault()
        save()
      }}
    >
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />

      <div className="flex items-center gap-2 px-4 pt-2">
        <Button asChild variant="secondary" size="icon">
          <Link to={`/log/${log.id}`} aria-label="Volver">
            <ChevronLeft strokeWidth={1.8} className="size-5" />
          </Link>
        </Button>
        <div className="flex flex-col gap-0.5">
          <Eyebrow className="text-[10px]">Editar registro</Eyebrow>
          <Title className="text-[28px]">{log.coffee?.name ?? 'Café'}</Title>
        </div>
      </div>

      <div className="relative px-6 pt-3">
        <Photo src={currentPhoto} className="aspect-[3/2] w-full rounded-[20px]" />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="absolute right-9 bottom-3 rounded-full bg-background/75 px-3 py-1.5 text-xs font-medium backdrop-blur-md"
        >
          {currentPhoto ? 'Cambiar foto' : 'Agregar foto'}
        </button>
      </div>

      <div className="px-6 pt-3">
        <ErrorBox message={error} />
      </div>

      <CoffeeLogForm form={form} onChange={setForm} />

      <div className="fixed inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-[max(env(safe-area-inset-bottom),12px)]">
        <div className="glass-solid flex w-full max-w-md gap-2 rounded-[24px] p-2">
          <Button asChild type="button" variant="outline" className="flex-1">
            <Link to={`/log/${log.id}`}>Cancelar</Link>
          </Button>
          <Button type="submit" className="flex-1" disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </Button>
        </div>
      </div>
    </form>
  )
}
