import type { Coffee, CoffeeLog } from './types'
import { flavorFamiliesOf, processOf, type TasteProfile } from './taste'

/**
 * "Cafés que van contigo": ordena los cafés publicados del catálogo según lo que el usuario
 * puntuó bien (4-5 estrellas). Suma puntos por coincidencia de origen, proceso y perfil de
 * tueste; excluye los que ya registró. Sin historial, devuelve los más recientes.
 */
export function recommendCoffees(published: Coffee[], logs: CoffeeLog[], limit = 10, taste?: TasteProfile | null): Coffee[] {
  const logged = new Set(logs.map((l) => l.coffee_id).filter(Boolean))
  const liked = logs.filter((l) => (l.rating ?? 0) >= 4 && l.coffee)
  const candidates = published.filter((c) => !logged.has(c.id))

  // Perfil de gusto declarado: familia de sabor +1,5 por coincidencia, proceso +1.
  const tasteScore = (c: Coffee) => {
    if (!taste) return 0
    let s = 0
    if (taste.flavors.length) {
      const fams = flavorFamiliesOf(c.tasting_notes ?? [])
      s += 1.5 * taste.flavors.filter((f) => fams.includes(f)).length
    }
    if (taste.process && processOf(c) === taste.process) s += 1
    return s
  }

  if (!liked.length) {
    if (!taste) return candidates.slice(0, limit)
    return [...candidates]
      .map((c) => ({ c, s: tasteScore(c) }))
      .sort((a, b) => b.s - a.s || (b.c.published_at ?? '').localeCompare(a.c.published_at ?? ''))
      .map((x) => x.c)
      .slice(0, limit)
  }

  const count = (pick: (c: Coffee) => string | null | undefined) => {
    const m = new Map<string, number>()
    for (const l of liked) {
      const k = norm(pick(l.coffee!))
      if (k) m.set(k, (m.get(k) ?? 0) + 1)
    }
    return m
  }
  const origins = count((c) => c.origin_country)
  const processes = count((c) => c.process)
  const profiles = count((c) => c.roast_profile)
  const roasters = count((c) => c.roaster?.name)

  const score = (c: Coffee) =>
    tasteScore(c) +
    2 * (origins.get(norm(c.origin_country)) ?? 0) +
    1.5 * (processes.get(norm(c.process)) ?? 0) +
    1 * (profiles.get(norm(c.roast_profile)) ?? 0) +
    1 * (roasters.get(norm(c.roaster?.name)) ?? 0)

  return candidates
    .map((c) => ({ c, s: score(c) }))
    .sort((a, b) => b.s - a.s || (b.c.published_at ?? '').localeCompare(a.c.published_at ?? ''))
    .map((x) => x.c)
    .slice(0, limit)
}

function norm(s: string | null | undefined): string {
  return (s ?? '').trim().toLowerCase()
}
