export type RoastProfile = 'espresso' | 'filtro' | 'omni'

export interface ScanResult {
  roaster_name: string | null
  roaster_country: string | null
  coffee_name: string | null
  origin_country: string | null
  region: string | null
  farm: string | null
  producer: string | null
  variety: string | null
  process: string | null
  altitude_masl: number | null
  /** Puntaje SCA (80-100) si la etiqueta lo indica. */
  sca_score: number | null
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
  /** Puntaje SCA (80-100) si la etiqueta lo indica. */
  sca_score: number | null
  roast_level: string | null
  roast_profile: RoastProfile | null
  tasting_notes: string[]
  photo_path?: string | null
  is_published?: boolean
  published_at?: string | null
  roaster?: Roaster | null
}

export type UserRole = 'user' | 'admin'

/** Puntaje promedio de los registros públicos de un café (vista coffee_public_stats). */
export interface CoffeePublicStats {
  coffee_id: string
  avg_rating: number | null
  ratings_count: number
}

/** Registro público de otro usuario en la ficha de un café. */
export interface PublicLog {
  id: string
  rating: number | null
  notes: string | null
  brew_method: string | null
  consumed_at: string
  profile: { display_name: string | null; avatar_url: string | null } | null
}

export type FeaturedAuthorRole = 'tostador' | 'campeon' | 'barista' | 'otro'

export interface FeaturedRecipe {
  id: string
  slug: string
  title: string
  author: string
  author_role: FeaturedAuthorRole
  country: string | null
  event: string | null
  method_family: MethodFamily
  dripper: string
  params: Partial<RecipeParams>
  steps: Array<{ time: string; action: string }>
  story: string | null
  source_url: string | null
  photo_path: string | null
  is_published: boolean
  sort_order: number
  created_at: string
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
  is_favorite: boolean
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
  /** Feedback post-preparación (más reciente primero); solo viene en listRecipesForLog. */
  feedback?: RecipeFeedback[]
}

export interface RecipeFeedback {
  id: string
  recipe_id: string
  signal: 'acido' | 'amargo' | 'debil' | 'intenso' | 'perfecto'
  note: string | null
  rule_id: string | null
  suggestion: string | null
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
  status?: 'pending' | 'approved' | 'rejected'
  google_maps_url?: string | null
  photo_path?: string | null
  created_by?: string | null
  rejection_reason?: string | null
  created_at?: string
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

/** Café escaneado pero todavía no probado: sin puntaje, sin método y sin notas. */
export function isPendingLog(log: { rating: number | null; brew_method: string | null; notes: string | null }): boolean {
  return !log.rating && !log.brew_method && !log.notes?.trim()
}

export const ALL_DRIPPERS = METHOD_FAMILIES.flatMap((f) => f.drippers)

// ---------------- Analítica (funciones admin_*, SPEC §8) ----------------

export interface UserFacts {
  user_id: string
  email: string | null
  provider: string | null
  display_name: string | null
  country: string | null
  role: UserRole | null
  created_at: string
  utm: Record<string, string> | null
  ref: string | null
  first_path: string | null
  device: string | null
  display_mode: string | null
  first_scan_at: string | null
  first_log_at: string | null
  first_recipe_at: string | null
  first_share_at: string | null
  hours_to_first_log: number | null
  logs_count: number
  scans_count: number
  recipes_count: number
  saved_recipes_count: number
  favorites_count: number
  public_logs_count: number
  cafes_proposed: number
  distinct_roasters: number
  distinct_origins: number
  avg_rating: number | null
  last_active_at: string | null
  active_days_7d: number
  active_days_30d: number
  events_count: number
  shares_sent: number
  share_opens: number
  signups_referred: number
}

export interface DailyMetric {
  day: string
  signups: number
  active_users: number
  scans: number
  logs: number
  recipes: number
  shares: number
  share_opens: number
}

export interface FunnelStep {
  step_order: number
  step: string
  users: number
}

export interface RetentionCell {
  cohort_week: string
  cohort_size: number
  week_n: number
  active_users: number
  pct: number
}

export interface TopItem {
  kind: 'coffee_logged' | 'roaster_logged' | 'coffee_viewed' | 'cafe_viewed'
  id: string
  label: string
  value: number
}
