import type { Equipment } from '@/lib/types'
import { Chip } from '@/components/ui/chip'
import { Input } from '@/components/ui/input'
import { Eyebrow, Field } from '@/components/primitives'

/**
 * Selección de equipo para una receta: parte del perfil, se ajusta con un toque.
 * `excluded` son los ítems del perfil apagados solo para esta receta; `extra` es texto
 * puntual; `espresso_machine` / `grinder` son lo que el usuario escribe cuando pide
 * espresso sin tenerlos en el perfil (se guardan en el perfil al generar).
 */
export interface EquipmentSelection {
  excluded: string[]
  extra: string
  espresso_machine: string
  grinder: string
}

export const EMPTY_SELECTION: EquipmentSelection = { excluded: [], extra: '', espresso_machine: '', grinder: '' }

interface Item {
  key: string
  label: string
  /** Cómo se nombra en el prompt. */
  prompt: string
}

/** Ítems del perfil relevantes para la receta. La máquina solo importa en espresso; los drippers ya van aparte. */
export function equipmentItems(e: Equipment | null | undefined, isEspresso: boolean): Item[] {
  if (!e) return []
  const items: Item[] = []
  if (e.grinder) items.push({ key: 'grinder', label: e.grinder, prompt: `molino ${e.grinder}` })
  if (isEspresso && e.espresso_machine) items.push({ key: 'machine', label: e.espresso_machine, prompt: `máquina ${e.espresso_machine}` })
  for (const o of (e.other ?? '').split(/[,;]/).map((s) => s.trim()).filter(Boolean)) {
    items.push({ key: `other:${o}`, label: o, prompt: o })
  }
  return items
}

/** Línea de equipo para el prompt a partir de la selección. */
export function equipmentSelectionToText(e: Equipment | null | undefined, isEspresso: boolean, sel: EquipmentSelection): string {
  const active = equipmentItems(e, isEspresso).filter((i) => !sel.excluded.includes(i.key)).map((i) => i.prompt)
  // Lo escrito en la tarjeta solo cuenta mientras falte en el perfil (al guardarse pasa a ser un chip).
  const missing = missingForEspresso(e, isEspresso)
  const typed = [
    missing.grinder && sel.grinder.trim() ? `molino ${sel.grinder.trim()}` : null,
    missing.machine && sel.espresso_machine.trim() ? `máquina ${sel.espresso_machine.trim()}` : null,
    sel.extra.trim() || null,
  ]
  return [...active, ...typed].filter(Boolean).join('; ')
}

/** Lo que falta en el perfil para una receta de espresso. */
export function missingForEspresso(e: Equipment | null | undefined, isEspresso: boolean): { machine: boolean; grinder: boolean } {
  if (!isEspresso) return { machine: false, grinder: false }
  return { machine: !e?.espresso_machine, grinder: !e?.grinder }
}

/** Parche para el perfil con lo que el usuario escribió en la tarjeta de espresso. */
export function espressoPatch(sel: EquipmentSelection): Partial<Equipment> {
  const patch: Partial<Equipment> = {}
  if (sel.espresso_machine.trim()) patch.espresso_machine = sel.espresso_machine.trim()
  if (sel.grinder.trim()) patch.grinder = sel.grinder.trim()
  return patch
}

export function EquipmentPicker({
  equipment,
  isEspresso,
  value,
  onChange,
}: {
  equipment: Equipment | null | undefined
  isEspresso: boolean
  value: EquipmentSelection
  onChange: (v: EquipmentSelection) => void
}) {
  const items = equipmentItems(equipment, isEspresso)
  const missing = missingForEspresso(equipment, isEspresso)
  const askEspresso = missing.machine || missing.grinder

  function toggle(key: string) {
    const excluded = value.excluded.includes(key) ? value.excluded.filter((k) => k !== key) : [...value.excluded, key]
    onChange({ ...value, excluded })
  }

  return (
    <div className="flex flex-col gap-3">
      {items.length > 0 && (
        <div className="flex flex-col gap-2">
          <Eyebrow className="text-[10px]">Mi equipo</Eyebrow>
          <div className="flex flex-wrap gap-2">
            {items.map((i) => (
              <Chip key={i.key} active={!value.excluded.includes(i.key)} onClick={() => toggle(i.key)}>
                {i.label}
              </Chip>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Tomado de tu perfil. Toca uno para dejarlo fuera solo en esta receta.</p>
        </div>
      )}

      {askEspresso && (
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card px-4 py-4">
          <div className="flex flex-col gap-0.5">
            <span className="text-[15px] font-medium">¿Con qué haces espresso?</span>
            <span className="text-xs text-muted-foreground">Con máquina y molino la receta es realista. Se guardan en tu perfil.</span>
          </div>
          {missing.machine && (
            <Field label="Máquina">
              <Input value={value.espresso_machine} onChange={(e) => onChange({ ...value, espresso_machine: e.target.value })} placeholder="Ej. Gaggia Classic, Flair 58" />
            </Field>
          )}
          {missing.grinder && (
            <Field label="Molino">
              <Input value={value.grinder} onChange={(e) => onChange({ ...value, grinder: e.target.value })} placeholder="Ej. 1Zpresso J-Max, Niche Zero" />
            </Field>
          )}
        </div>
      )}

      <Field
        label={items.length > 0 || askEspresso ? 'Algo más para esta receta' : 'Mi equipo'}
        hint={items.length > 0 || askEspresso ? undefined : 'Molino, balanza, hervidor. Guárdalo en Perfil para no escribirlo cada vez.'}
      >
        <Input value={value.extra} onChange={(e) => onChange({ ...value, extra: e.target.value })} placeholder={items.length > 0 || askEspresso ? 'Ej. agua filtrada, balanza sin timer' : 'Ej. Comandante C40'} />
      </Field>
    </div>
  )
}
