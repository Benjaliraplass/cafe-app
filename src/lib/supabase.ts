import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

if (!url || !key) {
  // Falla rápido y claro en desarrollo si faltan las variables.
  console.error('Faltan VITE_SUPABASE_URL o VITE_SUPABASE_PUBLISHABLE_KEY')
}

export const supabase = createClient(url ?? '', key ?? '', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})

export const PHOTOS_BUCKET = 'coffee-photos'

export function photoUrl(path: string | null | undefined): string | null {
  if (!path) return null
  return supabase.storage.from(PHOTOS_BUCKET).getPublicUrl(path).data.publicUrl
}
