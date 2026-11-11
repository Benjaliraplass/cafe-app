import { useState } from 'react'
import { ArrowRight } from 'lucide-react'
import type { RecipeFeedback as Feedback } from '@/lib/types'
import { BREW_SIGNALS, signalLabel, suggestionFor, type BrewSignal } from '@/lib/brewFeedback'
import { timeAgo } from '@/components/cards'
import { Chip } from '@/components/ui/chip'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

/**
 * "¿Cómo salió?" bajo una receta guardada: una señal (un toque) y el ajuste para la próxima vez.
 * Con feedback previo muestra el último y permite registrar otro intento.
 */
export function RecipeFeedbackBlock({
  method,
  feedback,
  onSave,
}: {
  method: string
  feedback: Feedback[]
  onSave?: (signal: BrewSignal, note: string | null, ruleId: string | null, suggestion: string) => Promise<void>
}) {
  const last = feedback[0] ?? null
  const [open, setOpen] = useState(last === null)
  const [signal, setSignal] = useState<BrewSignal | null>(null)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const preview = signal ? suggestionFor(signal, method) : null

  async function save() {
    if (!signal || !preview || !onSave) return
    setSaving(true)
    setError(null)
    try {
      await onSave(signal, note.trim() || null, preview.rule_id, preview.text)
      setOpen(false)
      setSignal(null)
      setNote('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  if (!open && last) {
    return (
      <div className="flex flex-col gap-2 rounded-2xl bg-card px-4 py-3.5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[13px]">
            <span className="font-medium">{signalLabel(last.signal)}</span>
            <span className="text-muted-foreground"> · {timeAgo(last.created_at)}</span>
          </span>
          <button type="button" onClick={() => setOpen(true)} className="text-[13px] font-medium text-muted-foreground">
            Lo preparé de nuevo
          </button>
        </div>
        {last.suggestion && (
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <ArrowRight className="mt-0.5 size-4 shrink-0" strokeWidth={1.8} />
            <span>
              <span className="font-medium text-foreground">Próxima vez:</span> {last.suggestion}
            </span>
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-card px-4 py-3.5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[15px] font-medium">¿Cómo salió?</span>
        {last && (
          <button type="button" onClick={() => setOpen(false)} className="text-[13px] text-muted-foreground">
            Cancelar
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {BREW_SIGNALS.map((s) => (
          <Chip key={s.id} active={signal === s.id} onClick={() => setSignal(signal === s.id ? null : s.id)}>
            {s.label}
          </Chip>
        ))}
      </div>
      {preview && (
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <ArrowRight className="mt-0.5 size-4 shrink-0" strokeWidth={1.8} />
          <span>
            <span className="font-medium text-foreground">Próxima vez:</span> {preview.text}
          </span>
        </p>
      )}
      {signal && (
        <>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="¿Algo más? (opcional)" />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button size="sm" onClick={save} disabled={saving || !onSave}>
            {saving ? 'Guardando...' : 'Guardar'}
          </Button>
        </>
      )}
    </div>
  )
}
