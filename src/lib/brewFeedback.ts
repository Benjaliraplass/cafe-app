// Feedback post-preparación (Lote 7c): una señal sobre cómo salió la taza y el ajuste
// sugerido para la próxima vez. Una sola variable por intento, según las reglas A01-A24
// de la base de conocimiento (docs/kb, tabla kb_rules). Ver SPEC §9.

export type BrewSignal = 'acido' | 'amargo' | 'debil' | 'intenso' | 'perfecto'

export const BREW_SIGNALS: { id: BrewSignal; label: string }[] = [
  { id: 'acido', label: 'Muy ácido' },
  { id: 'amargo', label: 'Amargo' },
  { id: 'debil', label: 'Débil' },
  { id: 'intenso', label: 'Muy intenso' },
  { id: 'perfecto', label: 'Perfecto' },
]

export interface BrewSuggestion {
  rule_id: string | null
  /** Qué cambiar la próxima vez, en una frase. */
  text: string
  /** Instrucción para el generador cuando se pide otra receta del mismo café y método. */
  prompt: string
}

type Family = 'espresso' | 'coldbrew' | 'filtro'

function familyOf(method: string): Family {
  const m = method.toLowerCase()
  if (/espresso|moka/.test(m)) return 'espresso'
  if (/cold/.test(m)) return 'coldbrew'
  return 'filtro'
}

/** Ajuste para la próxima preparación según la señal y el método. */
export function suggestionFor(signal: BrewSignal, method: string): BrewSuggestion {
  const fam = familyOf(method)
  switch (signal) {
    case 'acido':
      return fam === 'espresso'
        ? { rule_id: 'A06', text: 'Muele un paso más fino. Misma dosis y misma salida.', prompt: 'Salió muy ácido: moler un paso más fino, manteniendo dosis y salida (A06).' }
        : { rule_id: 'A01', text: 'Muele un paso más fino. Mismo ratio y misma agua.', prompt: 'Salió muy ácido: moler un paso más fino, manteniendo ratio y agua (A01).' }
    case 'amargo':
      return fam === 'espresso'
        ? { rule_id: 'A07', text: 'Muele un paso más grueso. Misma dosis y misma salida.', prompt: 'Salió amargo: moler un paso más grueso, manteniendo dosis y salida (A07).' }
        : { rule_id: 'A02', text: 'Muele un paso más grueso. Todo lo demás igual.', prompt: 'Salió amargo: moler un paso más grueso, manteniendo el resto igual (A02).' }
    case 'debil':
      if (fam === 'espresso') return { rule_id: 'A09', text: 'Baja la salida unos 2 g. Misma dosis y misma molienda.', prompt: 'Salió diluido: reducir la salida en 2 g, manteniendo dosis y molienda (A09).' }
      if (fam === 'coldbrew') return { rule_id: 'A13', text: 'Alarga un poco el tiempo de infusión. Solo eso.', prompt: 'Salió débil: alargar el tiempo de infusión un paso, sin tocar dosis ni molienda (A13).' }
      return { rule_id: 'A04', text: 'Usa un 5 % menos de agua. Misma molienda.', prompt: 'Salió débil: reducir el agua un 5 %, manteniendo la molienda (A04).' }
    case 'intenso':
      if (fam === 'espresso') return { rule_id: 'A08', text: 'Sube la salida unos 2 g. Misma dosis y misma molienda.', prompt: 'Salió muy intenso: aumentar la salida en 2 g, manteniendo dosis y molienda (A08).' }
      if (fam === 'coldbrew') return { rule_id: 'A12', text: 'Dilúyelo en la taza, 1:1 con agua o hielo.', prompt: 'Salió muy concentrado: indicar dilución en taza 1:1 (A12).' }
      return { rule_id: 'A05', text: 'Usa un 5 % más de agua. Misma molienda.', prompt: 'Salió muy intenso: aumentar el agua un 5 %, manteniendo la molienda (A05).' }
    case 'perfecto':
      return { rule_id: null, text: 'Repite igual. Anota el ajuste del molino para no perderlo.', prompt: 'La última vez salió perfecto: repetir la misma receta sin cambios.' }
  }
}

export function signalLabel(signal: BrewSignal): string {
  return BREW_SIGNALS.find((s) => s.id === signal)?.label ?? signal
}
