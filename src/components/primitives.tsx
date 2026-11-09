import type { ReactNode } from 'react'
import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Label } from '@/components/ui/label'

/** Etiqueta + control, como en los campos de Figma. */
export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string
  hint?: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <Label>{label}</Label>
      {children}
      {hint && <span className="text-xs text-tertiary">{hint}</span>}
    </div>
  )
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn('eyebrow', className)}>{children}</p>
}

export function Title({ children, className }: { children: ReactNode; className?: string }) {
  return <h1 className={cn('text-[34px] font-medium leading-[1.05] tracking-tightest', className)}>{children}</h1>
}

export function SectionTitle({ children, className }: { children: ReactNode; className?: string }) {
  return <h2 className={cn('text-[22px] font-medium leading-tight tracking-[-0.02em]', className)}>{children}</h2>
}

export function Rating({
  value,
  onChange,
  size = 'md',
}: {
  value: number | null
  onChange?: (v: number) => void
  size?: 'sm' | 'md' | 'lg'
}) {
  const px = { sm: 12, md: 18, lg: 30 }[size]
  const gap = { sm: 'gap-0.5', md: 'gap-1', lg: 'gap-2' }[size]
  return (
    <div className={cn('flex items-center', gap)} role={onChange ? 'radiogroup' : undefined}>
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = (value ?? 0) >= n
        return (
          <button
            key={n}
            type="button"
            disabled={!onChange}
            onClick={() => onChange?.(n)}
            aria-label={`${n} estrellas`}
            className="disabled:cursor-default"
          >
            <Star
              width={px}
              height={px}
              strokeWidth={1.5}
              className={filled ? 'fill-foreground text-foreground' : 'fill-transparent text-border-strong'}
            />
          </button>
        )
      })}
    </div>
  )
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 text-sm text-muted-foreground">
      <span className="inline-block size-4 animate-spin rounded-full border-2 border-border border-t-foreground" />
      {label}
    </div>
  )
}

export function ErrorBox({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
      {message}
    </div>
  )
}

export function Empty({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 py-20 text-center">
      <p className="text-xl font-medium tracking-[-0.02em]">{title}</p>
      {body && <p className="max-w-xs text-sm text-muted-foreground">{body}</p>}
      {action && <div className="pt-2">{action}</div>}
    </div>
  )
}

/** Foto o placeholder degradado (como en Figma) con esquinas redondeadas. */
export function Photo({
  src,
  className,
  alt = '',
}: {
  src?: string | null
  className?: string
  alt?: string
}) {
  return (
    <div className={cn('relative overflow-hidden bg-muted', className)}>
      {src ? (
        <img src={src} alt={alt} className="absolute inset-0 size-full object-cover" loading="lazy" />
      ) : (
        <div className="absolute inset-0 bg-[linear-gradient(135deg,#6b5c4d_0%,#2a2421_100%)]" />
      )}
    </div>
  )
}

export function StatTile({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-1 flex-col gap-1 rounded-2xl bg-card px-3.5 py-3.5">
      <span className="text-2xl font-medium tracking-[-0.02em]">{value}</span>
      <span className="text-[10px] font-medium uppercase tracking-eyebrow text-tertiary">{label}</span>
    </div>
  )
}

export function KeyValue({ k, v }: { k: string; v: string | null | undefined }) {
  if (!v) return null
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-medium uppercase tracking-eyebrow text-tertiary">{k}</span>
      <span className="text-[15px]">{v}</span>
    </div>
  )
}
