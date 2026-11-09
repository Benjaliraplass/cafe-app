import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { getProfile, updateEquipment } from '@/lib/api'
import { METHOD_FAMILIES, type Equipment } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Chip } from '@/components/ui/chip'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorBox, Eyebrow, Field, SectionTitle, Title } from '@/components/primitives'

export function Profile() {
  const { user, signOut } = useAuth()
  const [equipment, setEquipment] = useState<Equipment | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  useEffect(() => {
    if (!user) return
    getProfile(user.id)
      .then((p) => setEquipment(p?.equipment ?? {}))
      .catch((e) => setError(e.message))
  }, [user])

  async function save() {
    if (!user || !equipment) return
    setSaving(true)
    setError(null)
    try {
      await updateEquipment(user.id, equipment)
      setSavedAt(Date.now())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  function set<K extends keyof Equipment>(k: K, v: Equipment[K]) {
    setEquipment((e) => ({ ...(e ?? {}), [k]: v }))
    setSavedAt(null)
  }

  const drippers = equipment?.drippers ?? []

  return (
    <div>
      <header className="flex flex-col gap-1.5 px-6 pt-4">
        <Eyebrow>Cuenta</Eyebrow>
        <Title className="text-[38px]">Perfil</Title>
      </header>

      <div className="flex flex-col gap-3 px-6 pt-6">
        <Card className="flex flex-col gap-1 p-4">
          <Eyebrow className="text-[10px]">Correo</Eyebrow>
          <p className="text-[15px]">{user?.email}</p>
        </Card>
      </div>

      {/* Equipo */}
      <section className="flex flex-col gap-4 px-6 pt-8">
        <div className="flex flex-col gap-1">
          <SectionTitle>Mi equipo</SectionTitle>
          <p className="text-sm text-muted-foreground">
            Las recetas se ajustan a tu molino y a tus métodos. Tus drippers aparecen primero al pedir una receta.
          </p>
        </div>

        <ErrorBox message={error} />

        {!equipment ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-12" />
            <Skeleton className="h-24" />
            <Skeleton className="h-12" />
          </div>
        ) : (
          <>
            <Field label="Molino" hint="Marca y modelo. Ej. Comandante C40, Timemore C3, Baratza Encore">
              <Input value={equipment.grinder ?? ''} onChange={(e) => set('grinder', e.target.value)} placeholder="Ej. Comandante C40" />
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
                        <Chip key={d} active={on} onClick={() => set('drippers', on ? drippers.filter((x) => x !== d) : [...drippers, d])}>
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
                <Input value={equipment.espresso_machine ?? ''} onChange={(e) => set('espresso_machine', e.target.value)} placeholder="Ej. Gaggia Classic Pro" />
              </Field>
            )}

            <Field label="Otros" hint="Balanza, hervidor con control de temperatura, filtros, agua que usas">
              <Input value={equipment.other ?? ''} onChange={(e) => set('other', e.target.value)} placeholder="Ej. hervidor Fellow Stagg, agua filtrada" />
            </Field>

            <Button onClick={save} disabled={saving}>
              {saving ? 'Guardando...' : savedAt ? 'Guardado' : 'Guardar equipo'}
            </Button>
          </>
        )}
      </section>

      <div className="px-6 pt-10 pb-6">
        <Separator />
        <Card className="mt-6 flex flex-col gap-1 p-4 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Dripo · beta</p>
          <p>Versión inicial. Tus fotos y notas son privadas por defecto. Si algo falla, cuéntanos.</p>
        </Card>
        <Button variant="outline" className="mt-4 w-full" onClick={signOut}>
          Cerrar sesión
        </Button>
      </div>
    </div>
  )
}
