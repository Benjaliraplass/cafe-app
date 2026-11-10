import type { Coffee, CoffeeLog } from './types'

/**
 * Perfil de gusto. Basado en los atributos de catación (acidez, cuerpo) y en una versión
 * simplificada de la rueda de sabores de la SCA (familias), pensada para un aficionado.
 */

export type ProcessPref = 'lavado' | 'honey' | 'natural' | 'anaerobico'
export type FlavorFamily = 'frutal' | 'citrico' | 'floral' | 'chocolate' | 'dulce' | 'especiado'
export type Level3 = 'baja' | 'media' | 'alta'
export type Body3 = 'liviano' | 'medio' | 'intenso'
export type RoastPref = 'claro' | 'medio'
export type DrinkPref = 'filtro' | 'espresso' | 'leche' | 'todo'

export interface TasteProfile {
  process: ProcessPref | null
  flavors: FlavorFamily[]
  acidity: Level3 | null
  body: Body3 | null
  roast: RoastPref | null
  drink: DrinkPref | null
}

export const emptyTaste: TasteProfile = { process: null, flavors: [], acidity: null, body: null, roast: null, drink: null }

export const PROCESS_LABEL: Record<ProcessPref, string> = { lavado: 'Lavado', honey: 'Honey', natural: 'Natural', anaerobico: 'Anaeróbico' }
export const FLAVOR_LABEL: Record<FlavorFamily, string> = {
  frutal: 'Frutal',
  citrico: 'Cítrico',
  floral: 'Floral',
  chocolate: 'Chocolate y nuez',
  dulce: 'Caramelo y dulce',
  especiado: 'Especiado',
}
export const ACIDITY_LABEL: Record<Level3, string> = { baja: 'Acidez baja', media: 'Acidez media', alta: 'Acidez alta' }
export const BODY_LABEL: Record<Body3, string> = { liviano: 'Cuerpo liviano', medio: 'Cuerpo medio', intenso: 'Cuerpo intenso' }
export const ROAST_LABEL: Record<RoastPref, string> = { claro: 'Tueste claro', medio: 'Tueste medio' }
export const DRINK_LABEL: Record<DrinkPref, string> = { filtro: 'Filtro', espresso: 'Espresso', leche: 'Con leche', todo: 'De todo' }

export const FLAVOR_ORDER: FlavorFamily[] = ['frutal', 'citrico', 'floral', 'chocolate', 'dulce', 'especiado']

export function isTasteEmpty(t: TasteProfile | null | undefined): boolean {
  if (!t) return true
  return !t.process && t.flavors.length === 0 && !t.acidity && !t.body && !t.roast && !t.drink
}

/** Chips resumen del perfil declarado (máx. 4). */
export function tasteSummary(t: TasteProfile): string[] {
  const out: string[] = []
  if (t.process) out.push(PROCESS_LABEL[t.process])
  for (const f of t.flavors.slice(0, 2)) out.push(FLAVOR_LABEL[f])
  if (t.acidity) out.push(ACIDITY_LABEL[t.acidity])
  if (out.length < 4 && t.body) out.push(BODY_LABEL[t.body])
  if (out.length < 4 && t.drink) out.push(DRINK_LABEL[t.drink])
  return out.slice(0, 4)
}

/** Texto para el prompt de recetas ("Preferencia de taza"). */
export function tasteToPreferences(t: TasteProfile | null | undefined): string | null {
  if (!t || isTasteEmpty(t)) return null
  const parts: string[] = []
  if (t.flavors.length) parts.push(`le gustan los perfiles ${t.flavors.map((f) => FLAVOR_LABEL[f].toLowerCase()).join(' y ')}`)
  if (t.acidity) parts.push(`prefiere acidez ${t.acidity}`)
  if (t.body) parts.push(`cuerpo ${t.body}`)
  if (t.process) parts.push(`disfruta los cafés de proceso ${PROCESS_LABEL[t.process].toLowerCase()}`)
  if (t.roast) parts.push(`tueste ${t.roast}`)
  return parts.length ? `Perfil de gusto del usuario: ${parts.join(', ')}.` : null
}

// ---------- Inferencia desde el diario ----------

/** Palabras clave (minúsculas, sin tildes) → familia de sabor. */
const FLAVOR_KEYWORDS: Array<[FlavorFamily, string[]]> = [
  ['citrico', ['lima', 'limon', 'naranja', 'pomelo', 'mandarina', 'citric', 'bergamota', 'toronja', 'yuzu']],
  ['frutal', ['mango', 'durazno', 'damasco', 'frutilla', 'fresa', 'frambuesa', 'mora', 'arandano', 'cereza', 'uva', 'manzana', 'pera', 'pina', 'maracuya', 'papaya', 'platano', 'banana', 'frutos rojos', 'frutal', 'frutas', 'ciruela', 'guinda', 'melon', 'sandia', 'lichi', 'tropical', 'pasas', 'higo', 'tamarindo']],
  ['floral', ['jazmin', 'floral', 'flores', 'rosa', 'lavanda', 'azahar', 'bergamota', 'te negro', 'earl grey', 'hibisco']],
  ['chocolate', ['chocolate', 'cacao', 'nuez', 'nueces', 'avellana', 'almendra', 'mani', 'cocoa', 'nibs', 'tostado']],
  ['dulce', ['caramelo', 'panela', 'miel', 'azucar', 'dulce de leche', 'toffee', 'vainilla', 'melaza', 'chancaca', 'maple', 'butterscotch', 'dulce']],
  ['especiado', ['canela', 'clavo', 'cardamomo', 'especias', 'especiado', 'jengibre', 'nuez moscada', 'pimienta', 'anis']],
]

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
}

export function flavorFamiliesOf(notes: string[]): FlavorFamily[] {
  const found = new Set<FlavorFamily>()
  for (const n of notes) {
    const k = norm(n)
    for (const [fam, words] of FLAVOR_KEYWORDS) {
      if (words.some((w) => k.includes(w))) found.add(fam)
    }
  }
  return [...found]
}

export function processOf(c: Coffee | null | undefined): ProcessPref | null {
  const p = norm(c?.process ?? '')
  if (!p) return null
  if (p.includes('anaer') || p.includes('ferment') || p.includes('carbon') || p.includes('termal') || p.includes('thermal')) return 'anaerobico'
  if (p.includes('honey') || p.includes('miel') || p.includes('pulped')) return 'honey'
  if (p.includes('natural') || p.includes('seco')) return 'natural'
  if (p.includes('lavado') || p.includes('washed') || p.includes('humedo')) return 'lavado'
  return null
}

export interface InferredTaste {
  /** Registros considerados (puntaje 4-5). */
  sample: number
  processes: Partial<Record<ProcessPref, number>>
  flavors: Record<FlavorFamily, number>
  origins: Record<string, number>
  roasts: Record<string, number>
}

export function inferTaste(logs: CoffeeLog[]): InferredTaste {
  const liked = logs.filter((l) => (l.rating ?? 0) >= 4 && l.coffee)
  const out: InferredTaste = {
    sample: liked.length,
    processes: {},
    flavors: { frutal: 0, citrico: 0, floral: 0, chocolate: 0, dulce: 0, especiado: 0 },
    origins: {},
    roasts: {},
  }
  for (const l of liked) {
    const c = l.coffee!
    const p = processOf(c)
    if (p) out.processes[p] = (out.processes[p] ?? 0) + 1
    for (const f of flavorFamiliesOf(c.tasting_notes ?? [])) out.flavors[f] += 1
    if (c.origin_country) out.origins[c.origin_country] = (out.origins[c.origin_country] ?? 0) + 1
    if (c.roast_profile) out.roasts[c.roast_profile] = (out.roasts[c.roast_profile] ?? 0) + 1
  }
  return out
}

/** Perfil "efectivo": lo declarado manda; lo inferido completa huecos cuando hay muestra suficiente. */
export function effectiveTaste(declared: TasteProfile | null, inferred: InferredTaste): TasteProfile {
  const t: TasteProfile = { ...emptyTaste, ...(declared ?? {}), flavors: [...(declared?.flavors ?? [])] }
  if (inferred.sample >= 3) {
    if (!t.process) {
      const top = Object.entries(inferred.processes).sort((a, b) => b[1] - a[1])[0]
      if (top && top[1] >= 2) t.process = top[0] as ProcessPref
    }
    if (t.flavors.length === 0) {
      t.flavors = (Object.entries(inferred.flavors) as [FlavorFamily, number][])
        .filter(([, n]) => n > 0)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(([f]) => f)
    }
  }
  return t
}
