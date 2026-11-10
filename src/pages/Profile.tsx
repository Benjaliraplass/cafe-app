import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Camera, Mail, Shield } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { getProfile, getTasteProfile, listMyLogs, updateEquipment, updateProfile, uploadAvatar, upsertTasteProfile, type Profile as ProfileData } from '@/lib/api'
import { inferTaste, type InferredTaste, type TasteProfile } from '@/lib/taste'
import { TasteProfileCard } from '@/components/TasteProfileCard'
import { avatarUrl } from '@/lib/supabase'
import { imageToJpegBase64 } from '@/lib/image'
import { METHOD_FAMILIES, type Equipment } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Chip } from '@/components/ui/chip'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { CountrySelect, ErrorBox, Eyebrow, Field, SectionTitle, Spinner, Title } from '@/components/primitives'

export const FEEDBACK_EMAIL = 'benjamin@tostadoclub.com'
export const FEEDBACK_MAILTO = `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent('Feedback Dripo')}&body=${encodeURIComponent(
  'Hola Benjamín,\n\nTe escribo sobre Dripo:\n\n',
)}`

export function Profile() {
  const { user, signOut, refreshProfile } = useAuth()
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [taste, setTaste] = useState<TasteProfile | null>(null)
  const [inferred, setInferred] = useState<InferredTaste>(() => inferTaste([]))
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    getProfile(user.id)
      .then((p) => setProfile(p ?? { id: user.id, display_name: null, avatar_url: null, country: null, role: 'user', equipment: {} }))
      .catch((e) => setError(e.message))
    getTasteProfile(user.id).then(setTaste).catch(() => {})
    listMyLogs(user.id)
      .then((logs) => setInferred(inferTaste(logs)))
      .catch(() => {})
  }, [user])

  if (!user) return null

  return (
    <ProfileView
      email={user.email ?? ''}
      profile={profile}
      error={error}
      onError={setError}
      onProfileChange={setProfile}
      onUploadAvatar={async (file) => {
        const { blob } = await imageToJpegBase64(file, 512, 0.85)
        const path = await uploadAvatar(user.id, blob)
        refreshProfile()
        return path
      }}
      onSaveIdentity={async (fields) => {
        await updateProfile(user.id, fields)
        refreshProfile()
      }}
      onSaveEquipment={(eq) => updateEquipment(user.id, eq)}
      taste={taste}
      inferred={inferred}
      onSaveTaste={async (t) => {
        await upsertTasteProfile(user.id, t)
        setTaste(t)
      }}
      onSignOut={signOut}
    />
  )
}

export function ProfileView({
  email,
  profile,
  error,
  onError,
  onProfileChange,
  onUploadAvatar,
  onSaveIdentity,
  onSaveEquipment,
  taste,
  inferred,
  onSaveTaste,
  onSignOut,
}: {
  email: string
  profile: ProfileData | null
  error: string | null
  onError: (m: string | null) => void
  onProfileChange: (p: ProfileData) => void
  onUploadAvatar: (file: File) => Promise<string>
  onSaveIdentity: (fields: { display_name?: string | null; country?: string | null }) => Promise<void>
  onSaveEquipment: (eq: Equipment) => Promise<void>
  taste: TasteProfile | null
  inferred: InferredTaste
  onSaveTaste: (t: TasteProfile) => Promise<void>
  onSignOut: () => Promise<void>
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [savingIdentity, setSavingIdentity] = useState(false)
  const [identitySaved, setIdentitySaved] = useState(false)
  const [savingEq, setSavingEq] = useState(false)
  const [eqSaved, setEqSaved] = useState(false)

  async function pickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !profile) return
    setUploading(true)
    onError(null)
    try {
      const path = await onUploadAvatar(file)
      onProfileChange({ ...profile, avatar_url: path })
    } catch (err) {
      onError(err instanceof Error ? err.message : 'No se pudo subir la foto')
    } finally {
      setUploading(false)
    }
  }

  async function saveIdentity() {
    if (!profile) return
    setSavingIdentity(true)
    onError(null)
    try {
      await onSaveIdentity({ display_name: profile.display_name, country: profile.country })
      setIdentitySaved(true)
    } catch (err) {
      onError(err instanceof Error ? err.message : 'No se pudo guardar')
    } finally {
      setSavingIdentity(false)
    }
  }

  async function saveEquipment() {
    if (!profile) return
    setSavingEq(true)
    onError(null)
    try {
      await onSaveEquipment(profile.equipment)
      setEqSaved(true)
    } catch (err) {
      onError(err instanceof Error ? err.message : 'No se pudo guardar')
    } finally {
      setSavingEq(false)
    }
  }

  function setIdentity(patch: Partial<Pick<ProfileData, 'display_name' | 'country'>>) {
    if (!profile) return
    onProfileChange({ ...profile, ...patch })
    setIdentitySaved(false)
  }

  function setEq<K extends keyof Equipment>(k: K, v: Equipment[K]) {
    if (!profile) return
    onProfileChange({ ...profile, equipment: { ...profile.equipment, [k]: v } })
    setEqSaved(false)
  }

  const drippers = profile?.equipment.drippers ?? []
  const src = avatarUrl(profile?.avatar_url)
  const initial = (profile?.display_name || email || '?').trim().charAt(0).toUpperCase()

  return (
    <div>
      <header className="flex flex-col gap-1.5 px-6 pt-4">
        <Eyebrow>Cuenta</Eyebrow>
        <Title className="text-[38px]">Perfil</Title>
      </header>

      {/* Identidad */}
      <section className="flex flex-col gap-4 px-6 pt-6">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={!profile || uploading}
            aria-label="Cambiar foto de perfil"
            className="relative size-[84px] shrink-0 overflow-hidden rounded-full bg-muted ring-1 ring-border transition-transform active:scale-95 disabled:opacity-70"
          >
            {src ? (
              <img src={src} alt="" className="size-full object-cover" />
            ) : (
              <span className="flex size-full items-center justify-center text-[30px] font-medium text-muted-foreground">{initial}</span>
            )}
            <span className="absolute inset-x-0 bottom-0 flex h-7 items-center justify-center gap-1 bg-foreground/80 text-[10px] font-medium text-background backdrop-blur-sm">
              {uploading ? <Spinner /> : <Camera width={12} height={12} strokeWidth={2} />}
              {uploading ? '' : 'Foto'}
            </span>
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pickAvatar} />

          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <Eyebrow className="text-[10px]">Correo</Eyebrow>
            <p className="truncate text-[15px]">{email}</p>
          </div>
        </div>

        <ErrorBox message={error} />

        {!profile ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
        ) : (
          <>
            <Field label="Nombre">
              <Input
                value={profile.display_name ?? ''}
                onChange={(e) => setIdentity({ display_name: e.target.value })}
                placeholder="Cómo quieres que te llamemos"
                autoComplete="name"
              />
            </Field>
            <Field label="Nacionalidad">
              <CountrySelect value={profile.country ?? ''} onChange={(v) => setIdentity({ country: v || null })} />
            </Field>
            <Button onClick={saveIdentity} disabled={savingIdentity} variant="secondary">
              {savingIdentity ? 'Guardando...' : identitySaved ? 'Guardado' : 'Guardar perfil'}
            </Button>
          </>
        )}
      </section>

      {/* Perfil de gusto */}
      <div className="px-6 pt-10">
        <TasteProfileCard declared={taste} inferred={inferred} onSave={onSaveTaste} />
      </div>

      {/* Equipo */}
      <section className="flex flex-col gap-4 px-6 pt-10">
        <div className="flex flex-col gap-1">
          <SectionTitle>Mi equipo</SectionTitle>
          <p className="text-sm text-muted-foreground">
            Las recetas se ajustan a tu molino y a tus métodos. Tus drippers aparecen primero al pedir una receta.
          </p>
        </div>

        {!profile ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-12" />
            <Skeleton className="h-24" />
            <Skeleton className="h-12" />
          </div>
        ) : (
          <>
            <Field label="Molino" hint="Marca y modelo. Ej. Comandante C40, Timemore C3, Baratza Encore">
              <Input value={profile.equipment.grinder ?? ''} onChange={(e) => setEq('grinder', e.target.value)} placeholder="Ej. Comandante C40" />
            </Field>

            <div className="flex flex-col gap-3">
              <Eyebrow className="text-[11px]">Métodos que tengo</Eyebrow>
              {METHOD_FAMILIES.map((f) => (
                <div key={f.id} className="flex flex-col gap-2">
                  <span className="text-xs text-muted-foreground">{f.label}</span>
                  <div className="flex flex-wrap gap-2">
                    {f.drippers.map((d) => {
                      const on = drippers.includes(d)
                      return (
                        <Chip key={d} active={on} onClick={() => setEq('drippers', on ? drippers.filter((x) => x !== d) : [...drippers, d])}>
                          {d}
                        </Chip>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            {drippers.includes('Espresso') && (
              <Field label="Máquina de espresso" hint="Ej. Gaggia Classic, Flair 58, Breville Bambino">
                <Input
                  value={profile.equipment.espresso_machine ?? ''}
                  onChange={(e) => setEq('espresso_machine', e.target.value)}
                  placeholder="Ej. Gaggia Classic Pro"
                />
              </Field>
            )}

            <Field label="Otros" hint="Balanza, hervidor con control de temperatura, filtros, agua que usas">
              <Input
                value={profile.equipment.other ?? ''}
                onChange={(e) => setEq('other', e.target.value)}
                placeholder="Ej. hervidor Fellow Stagg, agua filtrada"
              />
            </Field>

            <Button onClick={saveEquipment} disabled={savingEq}>
              {savingEq ? 'Guardando...' : eqSaved ? 'Guardado' : 'Guardar equipo'}
            </Button>
          </>
        )}
      </section>

      <div className="px-6 pt-10 pb-6">
        <Separator />
        <Card className="mt-6 flex flex-col gap-3 p-4 text-sm text-muted-foreground">
          <div className="flex flex-col gap-1">
            <p className="font-medium text-foreground">Dripo · beta</p>
            <p>
              Versión inicial. Tus fotos y notas son privadas por defecto (ver{' '}
              <Link to="/privacidad" className="underline underline-offset-4">
                política de privacidad
              </Link>
              ). Si algo falla o se te ocurre una mejora, escríbenos.
            </p>
          </div>
          <Button asChild variant="outline" size="sm" className="w-full">
            <a href={FEEDBACK_MAILTO}>
              <Mail width={16} height={16} strokeWidth={1.8} />
              Enviar feedback
            </a>
          </Button>
        </Card>
        {profile?.role === 'admin' && (
          <Button asChild variant="secondary" className="mt-4 w-full">
            <Link to="/admin">
              <Shield className="size-4" strokeWidth={1.8} /> Administración
            </Link>
          </Button>
        )}
        <Button variant="outline" className="mt-4 w-full" onClick={onSignOut}>
          Cerrar sesión
        </Button>
      </div>
    </div>
  )
}
