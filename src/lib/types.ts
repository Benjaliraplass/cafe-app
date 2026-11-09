export type RoastProfile = 'espresso' | 'filtro' | 'omni'

export interface ScanResult {
  roaster_name: string | null
  coffee_name: string | null
  origin_country: string | null
  region: string | null
  farm: string | null
  producer: string | null
  variety: string | null
  process: string | null
  altitude_masl: number | null
  roast_level: string | null
  roast_profile: RoastProfile | null
  tasting_notes: string[]
  roast_date: string | null
  weight_grams: number | null
  confidence: 'alta' | 'media' | 'baja'
  is_coffee_label: boolean
  notes_for_user: string | null
}

export interface Roaster {
  id: string
  name: string
  slug: string
  country: string | null
  city: string | null
  website: string | null
  instagram: string | null
}

export interface Coffee {
  id: string
  roaster_id: string | null
  name: string
  origin_country: string | null
  region: string | null
  farm: string | null
  producer: string | null
  variety: string | null
  process: string | null
  altitude_masl: number | null
  roast_level: string | null
  roast_profile: RoastProfile | null
  tasting_notes: string[]
  roaster?: Roaster | null
}

export interface CoffeeLog {
  id: string
  user_id: string
  coffee_id: string | null
  photo_path: string | null
  rating: number | null
  notes: string | null
  brew_method: string | null
  roast_date: string | null
  bought_at: string | null
  price_clp: number | null
  is_public: boolean
  consumed_at: string
  created_at: string
  coffee?: Coffee | null
}

export interface RecipeParams {
  dose_g: number
  water_g: number | null
  ratio: string
  water_temp_c: number
  grind: string
  grind_reference: string | null
  total_time: string
  yield_g: number | null
  pressure_bar: number | null
}

export interface RecipeData {
  title: string
  brew_method: string
  params: RecipeParams
  steps: Array<{ time: string; action: string }>
  rationale: string
  adjustments: Array<{ if: string; then: string }>
  rest_advice: string | null
}

export interface Recipe {
  id: string
  coffee_log_id: string | null
  brew_method: string
  title: string | null
  params: RecipeParams
  steps: Array<{ time: string; action: string }>
  rationale: string | null
  created_at: string
}

export interface Cafe {
  id: string
  name: string
  slug: string
  kind: 'cafe' | 'roastery' | 'both'
  address: string | null
  comuna: string | null
  city: string | null
  region: string | null
  instagram: string | null
  website: string | null
  description: string | null
  lat: number | null
  lng: number | null
}

export const BREW_METHODS = [
  'V60',
  'Espresso',
  'Aeropress',
  'Chemex',
  'Kalita',
  'Prensa francesa',
  'Moka',
  'Cold brew',
] as const

export type MethodFamily = 'conico' | 'flat' | 'inmersion' | 'espresso'

export const METHOD_FAMILIES: { id: MethodFamily; label: string; hint: string; drippers: string[] }[] = [
  { id: 'conico', label: 'Filtro cónico', hint: 'V60, Origami, Chemex', drippers: ['V60', 'Origami', 'Chemex'] },
  { id: 'flat', label: 'Fondo plano', hint: 'Kalita, Orea, April', drippers: ['Kalita Wave', 'Orea', 'April', 'Fellow Stagg'] },
  { id: 'inmersion', label: 'Inmersión', hint: 'Aeropress, prensa, Clever', drippers: ['Aeropress', 'Prensa francesa', 'Clever', 'Switch'] },
  { id: 'espresso', label: 'Espresso', hint: 'Máquina de espresso', drippers: ['Espresso'] },
]

export const TASTE_PREFERENCES = ['Más dulce', 'Más brillante', 'Más cuerpo', 'Más limpio'] as const

export interface Equipment {
  grinder?: string
  drippers?: string[]
  espresso_machine?: string
  other?: string
}

export const ALL_DRIPPERS = METHOD_FAMILIES.flatMap((f) => f.drippers)

/** Resume el equipo del perfil en una línea para el prompt de recetas. */
export function equipmentToText(e: Equipment | null | undefined): string {
  if (!e) return ''
  return [
    e.grinder ? `molino ${e.grinder}` : null,
    e.espresso_machine ? `máquina ${e.espresso_machine}` : null,
    e.drippers?.length ? `drippers: ${e.drippers.join(', ')}` : null,
    e.other || null,
  ]
    .filter(Boolean)
    .join('; ')
}
