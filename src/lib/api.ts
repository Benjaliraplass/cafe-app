import { supabase, PHOTOS_BUCKET, AVATARS_BUCKET } from './supabase'
import type { Cafe, Coffee, CoffeeLog, Equipment, MethodFamily, Recipe, RecipeData, ScanResult } from './types'

// ---------- Utilidades ----------

export function slugify(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

async function invoke<T>(fn: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(fn, { body })
  if (error) {
    // supabase-js envuelve errores HTTP; intentamos rescatar el mensaje del body
    let msg = error.message
    try {
      const ctx = (error as { context?: Response }).context
      if (ctx && typeof ctx.json === 'function') {
        const j = await ctx.json()
        if (j?.error) msg = j.error
      }
    } catch {
      // ignorar
    }
    throw new Error(msg)
  }
  if (!data?.ok) throw new Error(data?.error ?? 'Error desconocido')
  return data.data as T
}

// ---------- IA ----------

export function scanLabel(image_base64: string, media_type = 'image/jpeg') {
  return invoke<ScanResult>('scan-label', { image_base64, media_type })
}

export interface SuggestRecipeInput {
  coffee?: (Partial<Coffee> & { roaster_name?: string | null; roast_date?: string | null }) | null
  coffee_description?: string
  method_family?: MethodFamily
  dripper: string
  servings?: number
  dose_g?: number
  equipment?: string
  preferences?: string
}

export function suggestRecipe(input: SuggestRecipeInput) {
  return invoke<RecipeData>('suggest-recipe', input as unknown as Record<string, unknown>)
}

/** Convierte un CoffeeLog en el bloque `coffee` que espera la función de recetas. */
export function coffeeFromLog(log: CoffeeLog): SuggestRecipeInput['coffee'] {
  const c = log.coffee
  return {
    name: c?.name,
    roaster_name: c?.roaster?.name ?? null,
    origin_country: c?.origin_country,
    region: c?.region,
    farm: c?.farm,
    variety: c?.variety,
    process: c?.process,
    altitude_masl: c?.altitude_masl,
    roast_level: c?.roast_level,
    roast_profile: c?.roast_profile,
    tasting_notes: c?.tasting_notes,
    roast_date: log.roast_date,
  }
}

// ---------- Guardar un café escaneado ----------

export interface SaveLogInput {
  userId: string
  photoBlob: Blob | null
  scan: ScanResult | null
  coffee: {
    roaster_name: string
    roaster_country: string | null
    name: string
    origin_country: string | null
    region: string | null
    farm: string | null
    producer: string | null
    variety: string | null
    process: string | null
    altitude_masl: number | null
    roast_level: string | null
    roast_profile: Coffee['roast_profile']
    tasting_notes: string[]
  }
  log: {
    rating: number | null
    notes: string | null
    brew_method: string | null
    roast_date: string | null
    bought_at: string | null
    price_clp: number | null
  }
}

export async function saveLog(input: SaveLogInput): Promise<string> {
  const { userId, photoBlob, scan, coffee, log } = input

  // 1. Foto
  let photo_path: string | null = null
  if (photoBlob) {
    photo_path = `${userId}/${crypto.randomUUID()}.jpg`
    const { error } = await supabase.storage
      .from(PHOTOS_BUCKET)
      .upload(photo_path, photoBlob, { contentType: 'image/jpeg', upsert: false })
    if (error) throw new Error(`No se pudo subir la foto: ${error.message}`)
  }

  // 2. Tostador (buscar por slug, crear si no existe)
  let roaster_id: string | null = null
  const roasterName = coffee.roaster_name.trim()
  if (roasterName) {
    const slug = slugify(roasterName)
    const { data: existing } = await supabase.from('roasters').select('id, country').eq('slug', slug).maybeSingle()
    if (existing) {
      roaster_id = existing.id
      // Solo el creador puede actualizar (RLS); si no es mío, la actualización no afecta filas y seguimos
      if (coffee.roaster_country && coffee.roaster_country !== existing.country) {
        await supabase.from('roasters').update({ country: coffee.roaster_country }).eq('id', existing.id)
      }
    } else {
      const { data: created, error } = await supabase
        .from('roasters')
        .insert({ name: roasterName, slug, country: coffee.roaster_country ?? 'Chile', created_by: userId })
        .select('id')
        .single()
      if (error) throw new Error(`No se pudo crear el tostador: ${error.message}`)
      roaster_id = created.id
    }
  }

  // 3. Café (buscar por tostador + nombre, crear si no existe)
  let coffee_id: string | null = null
  const coffeeName = coffee.name.trim() || 'Café sin nombre'
  {
    let q = supabase.from('coffees').select('id').ilike('name', coffeeName)
    q = roaster_id ? q.eq('roaster_id', roaster_id) : q.is('roaster_id', null)
    const { data: existing } = await q.limit(1).maybeSingle()
    if (existing) {
      coffee_id = existing.id
    } else {
      const { data: created, error } = await supabase
        .from('coffees')
        .insert({
          roaster_id,
          name: coffeeName,
          origin_country: coffee.origin_country,
          region: coffee.region,
          farm: coffee.farm,
          producer: coffee.producer,
          variety: coffee.variety,
          process: coffee.process,
          altitude_masl: coffee.altitude_masl,
          roast_level: coffee.roast_level,
          roast_profile: coffee.roast_profile,
          tasting_notes: coffee.tasting_notes,
          created_by: userId,
        })
        .select('id')
        .single()
      if (error) throw new Error(`No se pudo crear el café: ${error.message}`)
      coffee_id = created.id
    }
  }

  // 4. Registro del diario
  const { data: created, error } = await supabase
    .from('coffee_logs')
    .insert({
      user_id: userId,
      coffee_id,
      photo_path,
      rating: log.rating,
      notes: log.notes,
      brew_method: log.brew_method,
      roast_date: log.roast_date,
      bought_at: log.bought_at,
      price_clp: log.price_clp,
      raw_scan: scan,
    })
    .select('id')
    .single()
  if (error) throw new Error(`No se pudo guardar el registro: ${error.message}`)
  return created.id
}

// ---------- Lecturas ----------

const LOG_SELECT = `
  id, user_id, coffee_id, photo_path, rating, notes, brew_method, roast_date, bought_at, price_clp,
  is_public, is_favorite, consumed_at, created_at,
  coffee:coffees (
    id, roaster_id, name, origin_country, region, farm, producer, variety, process, altitude_masl,
    roast_level, roast_profile, tasting_notes,
    roaster:roasters ( id, name, slug, country, city, website, instagram )
  )
`

export async function listMyLogs(userId: string): Promise<CoffeeLog[]> {
  const { data, error } = await supabase
    .from('coffee_logs')
    .select(LOG_SELECT)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as CoffeeLog[]
}

export async function getLog(id: string): Promise<CoffeeLog | null> {
  const { data, error } = await supabase.from('coffee_logs').select(LOG_SELECT).eq('id', id).maybeSingle()
  if (error) throw new Error(error.message)
  return (data as unknown as CoffeeLog) ?? null
}

export interface UpdateLogInput {
  userId: string
  log: CoffeeLog
  photoBlob: Blob | null
  coffee: SaveLogInput['coffee']
  logFields: SaveLogInput['log']
}

/**
 * Actualiza un registro. El café del catálogo se actualiza si lo creé yo; si pertenece a otro usuario
 * (RLS no permite editarlo), se crea una copia propia y se re-enlaza el registro.
 */
export async function updateLog(input: UpdateLogInput): Promise<void> {
  const { userId, log, photoBlob, coffee, logFields } = input

  // 1. Foto nueva (opcional)
  let photo_path = log.photo_path
  if (photoBlob) {
    const path = `${userId}/${crypto.randomUUID()}.jpg`
    const { error } = await supabase.storage.from(PHOTOS_BUCKET).upload(path, photoBlob, { contentType: 'image/jpeg' })
    if (error) throw new Error(`No se pudo subir la foto: ${error.message}`)
    photo_path = path
  }

  // 2. Tostador
  let roaster_id: string | null = log.coffee?.roaster_id ?? null
  const roasterName = coffee.roaster_name.trim()
  if (roasterName) {
    const slug = slugify(roasterName)
    const { data: existing } = await supabase.from('roasters').select('id, country').eq('slug', slug).maybeSingle()
    if (existing) {
      roaster_id = existing.id
      if (coffee.roaster_country && coffee.roaster_country !== existing.country) {
        await supabase.from('roasters').update({ country: coffee.roaster_country }).eq('id', existing.id)
      }
    } else {
      const { data: created, error } = await supabase
        .from('roasters')
        .insert({ name: roasterName, slug, country: coffee.roaster_country ?? 'Chile', created_by: userId })
        .select('id')
        .single()
      if (error) throw new Error(`No se pudo crear el tostador: ${error.message}`)
      roaster_id = created.id
    }
  } else {
    roaster_id = null
  }

  // 3. Café: intentar actualizar el existente; si RLS no lo permite (0 filas), crear uno propio
  const coffeeFields = {
    roaster_id,
    name: coffee.name.trim() || 'Café sin nombre',
    origin_country: coffee.origin_country,
    region: coffee.region,
    farm: coffee.farm,
    producer: coffee.producer,
    variety: coffee.variety,
    process: coffee.process,
    altitude_masl: coffee.altitude_masl,
    roast_level: coffee.roast_level,
    roast_profile: coffee.roast_profile,
    tasting_notes: coffee.tasting_notes,
  }
  let coffee_id = log.coffee_id
  let updated = false
  if (coffee_id) {
    const { data, error } = await supabase.from('coffees').update(coffeeFields).eq('id', coffee_id).select('id')
    if (error) throw new Error(`No se pudo actualizar el café: ${error.message}`)
    updated = (data?.length ?? 0) > 0
  }
  if (!updated) {
    const { data: created, error } = await supabase
      .from('coffees')
      .insert({ ...coffeeFields, created_by: userId })
      .select('id')
      .single()
    if (error) throw new Error(`No se pudo crear el café: ${error.message}`)
    coffee_id = created.id
  }

  // 4. Registro
  const { error } = await supabase
    .from('coffee_logs')
    .update({ coffee_id, photo_path, ...logFields })
    .eq('id', log.id)
  if (error) throw new Error(`No se pudo guardar el registro: ${error.message}`)
}

export async function setFavorite(id: string, value: boolean): Promise<void> {
  const { error } = await supabase.from('coffee_logs').update({ is_favorite: value }).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function deleteLog(id: string): Promise<void> {
  const { error } = await supabase.from('coffee_logs').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function listRecipesForLog(logId: string): Promise<Recipe[]> {
  const { data, error } = await supabase
    .from('recipes')
    .select('id, coffee_log_id, brew_method, title, params, steps, rationale, created_at')
    .eq('coffee_log_id', logId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as Recipe[]
}

export async function saveRecipe(input: {
  userId: string
  coffeeId: string | null
  logId: string | null
  recipe: RecipeData
}): Promise<void> {
  const { error } = await supabase.from('recipes').insert({
    user_id: input.userId,
    coffee_id: input.coffeeId,
    coffee_log_id: input.logId,
    brew_method: input.recipe.brew_method,
    title: input.recipe.title,
    params: input.recipe.params,
    steps: input.recipe.steps,
    rationale: [
      input.recipe.rationale,
      input.recipe.rest_advice ? `Reposo: ${input.recipe.rest_advice}` : null,
      input.recipe.adjustments.length
        ? 'Ajustes: ' + input.recipe.adjustments.map((a) => `si ${a.if}, ${a.then}`).join('; ')
        : null,
    ]
      .filter(Boolean)
      .join('\n\n'),
    source: 'ai',
  })
  if (error) throw new Error(error.message)
}

export async function listCafes(): Promise<Cafe[]> {
  const { data, error } = await supabase
    .from('cafes')
    .select('id, name, slug, kind, address, comuna, city, region, instagram, website, description, lat, lng')
    .eq('status', 'approved')
    .order('city')
    .order('name')
  if (error) throw new Error(error.message)
  return (data ?? []) as Cafe[]
}

export interface SavedRecipe extends Recipe {
  coffee: { id: string; name: string; roaster: { name: string } | null } | null
}

export async function listMyRecipes(userId: string): Promise<SavedRecipe[]> {
  const { data, error } = await supabase
    .from('recipes')
    .select('id, coffee_log_id, brew_method, title, params, steps, rationale, created_at, coffee:coffees ( id, name, roaster:roasters ( name ) )')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as unknown as SavedRecipe[]
}

// ---------- Perfil ----------

export interface Profile {
  id: string
  display_name: string | null
  avatar_url: string | null
  country: string | null
  equipment: Equipment
}

const PROFILE_SELECT = 'id, display_name, avatar_url, country, equipment'

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select(PROFILE_SELECT).eq('id', userId).maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  return {
    id: data.id,
    display_name: data.display_name,
    avatar_url: data.avatar_url,
    country: data.country,
    equipment: (data.equipment ?? {}) as Equipment,
  }
}

export async function updateEquipment(userId: string, equipment: Equipment): Promise<void> {
  const clean: Equipment = {
    grinder: equipment.grinder?.trim() || undefined,
    espresso_machine: equipment.espresso_machine?.trim() || undefined,
    other: equipment.other?.trim() || undefined,
    drippers: equipment.drippers?.length ? equipment.drippers : undefined,
  }
  const { error } = await supabase.from('profiles').update({ equipment: clean }).eq('id', userId)
  if (error) throw new Error(error.message)
}

export async function updateProfile(
  userId: string,
  fields: { display_name?: string | null; country?: string | null },
): Promise<void> {
  const patch: Record<string, string | null> = {}
  if ('display_name' in fields) patch.display_name = fields.display_name?.trim() || null
  if ('country' in fields) patch.country = fields.country?.trim() || null
  const { error } = await supabase.from('profiles').update(patch).eq('id', userId)
  if (error) throw new Error(error.message)
}

/**
 * Sube la foto de perfil al bucket `avatars` en la carpeta del usuario y guarda la
 * ruta en `profiles.avatar_url`. Se agrega un sufijo de versión para evitar la caché del CDN.
 */
export async function uploadAvatar(userId: string, blob: Blob): Promise<string> {
  const path = `${userId}/avatar-${Date.now()}.jpg`
  const { error: upErr } = await supabase.storage
    .from(AVATARS_BUCKET)
    .upload(path, blob, { contentType: 'image/jpeg', upsert: true })
  if (upErr) throw new Error(upErr.message)

  const { error } = await supabase.from('profiles').update({ avatar_url: path }).eq('id', userId)
  if (error) throw new Error(error.message)

  // Limpieza best-effort de avatares anteriores del mismo usuario.
  const { data: files } = await supabase.storage.from(AVATARS_BUCKET).list(userId)
  const old = (files ?? []).map((f) => `${userId}/${f.name}`).filter((p) => p !== path)
  if (old.length) await supabase.storage.from(AVATARS_BUCKET).remove(old)

  return path
}
