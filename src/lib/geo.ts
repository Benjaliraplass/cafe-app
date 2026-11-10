/** Utilidades de geografía: distancia, geocodificación (Nominatim/OSM) y enlaces a mapas. */

export interface LatLng {
  lat: number
  lng: number
}

/** Centro por defecto: Santiago de Chile. */
export const DEFAULT_CENTER: LatLng = { lat: -33.4372, lng: -70.6506 }

/** Distancia en km (haversine). */
export function distanceKm(a: LatLng, b: LatLng): number {
  const R = 6371
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}
const rad = (d: number) => (d * Math.PI) / 180

export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`
  return `${km.toFixed(km < 10 ? 1 : 0).replace('.', ',')} km`
}

/** Posición del usuario solo si ya dio permiso antes (no muestra el diálogo). */
export async function silentPosition(): Promise<LatLng | null> {
  if (!('geolocation' in navigator)) return null
  try {
    const perm = await navigator.permissions?.query({ name: 'geolocation' as PermissionName })
    if (perm && perm.state !== 'granted') return null
  } catch {
    return null
  }
  return currentPosition()
}

/** Pide la posición (puede mostrar el diálogo de permiso). */
export function currentPosition(timeoutMs = 8000): Promise<LatLng | null> {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) return resolve(null)
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 60_000 },
    )
  })
}

export interface GeocodeHit {
  label: string
  lat: number
  lng: number
  address: string | null
  comuna: string | null
  city: string | null
  region: string | null
  country: string | null
}

/** Geocodifica una dirección con Nominatim (OpenStreetMap). Uso ligero: una consulta por búsqueda del usuario. */
export async function geocode(query: string, limit = 5): Promise<GeocodeHit[]> {
  const url = new URL('https://nominatim.openstreetmap.org/search')
  url.searchParams.set('q', query)
  url.searchParams.set('format', 'jsonv2')
  url.searchParams.set('addressdetails', '1')
  url.searchParams.set('limit', String(limit))
  url.searchParams.set('accept-language', 'es')
  const res = await fetch(url.toString(), { headers: { accept: 'application/json' } })
  if (!res.ok) throw new Error('No se pudo buscar la dirección')
  const rows = (await res.json()) as Array<{
    display_name: string
    lat: string
    lon: string
    address?: Record<string, string>
  }>
  return rows.map((r) => {
    const a = r.address ?? {}
    const street = [a.road, a.house_number].filter(Boolean).join(' ')
    return {
      label: r.display_name,
      lat: Number(r.lat),
      lng: Number(r.lon),
      address: street || null,
      comuna: a.suburb ?? a.city_district ?? a.municipality ?? a.town ?? a.village ?? null,
      city: a.city ?? a.town ?? a.state_district ?? a.county ?? null,
      region: a.state ?? null,
      country: a.country ?? null,
    }
  })
}

export function directionsUrl(p: LatLng): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`
}

export function instagramUrl(handle: string): string {
  const h = handle.trim().replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/\/$/, '')
  return `https://instagram.com/${h}`
}
