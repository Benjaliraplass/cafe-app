import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react'

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' }) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100'
  const styles = {
    primary: 'bg-accent text-bg hover:bg-accent-2',
    ghost: 'bg-card text-ink hover:bg-card-2 border border-line',
    danger: 'bg-transparent text-danger border border-danger/40 hover:bg-danger/10',
  }[variant]
  return <button className={`${base} ${styles} ${className}`} {...props} />
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-ink-3">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-3">{hint}</span>}
    </label>
  )
}

const inputCls =
  'w-full rounded-xl border border-line bg-bg-2 px-3.5 py-3 text-base text-ink placeholder:text-ink-3 outline-none focus:border-accent'

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={inputCls} {...props} />
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${inputCls} min-h-[88px] resize-y`} {...props} />
}

export function Chip({
  active,
  children,
  onClick,
}: {
  active?: boolean
  children: ReactNode
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3.5 py-1.5 text-sm transition ${
        active ? 'border-accent bg-accent text-bg font-semibold' : 'border-line bg-card text-ink-2 hover:bg-card-2'
      }`}
    >
      {children}
    </button>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-line bg-card p-4 ${className}`}>{children}</div>
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
  const px = { sm: 'text-base', md: 'text-2xl', lg: 'text-3xl' }[size]
  return (
    <div className={`flex gap-1 ${px} leading-none`} role={onChange ? 'radiogroup' : undefined}>
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = (value ?? 0) >= n
        const half = !filled && (value ?? 0) >= n - 0.5
        return (
          <button
            key={n}
            type="button"
            disabled={!onChange}
            onClick={() => onChange?.(value === n ? n - 0.5 : n)}
            className={`${filled ? 'text-accent' : half ? 'text-accent/60' : 'text-line'} disabled:cursor-default`}
            aria-label={`${n} estrellas`}
          >
            {half ? '⯪' : '★'}
          </button>
        )
      })}
    </div>
  )
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 text-sm text-ink-2">
      <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-line border-t-accent" />
      {label}
    </div>
  )
}

export function ErrorBox({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <div className="rounded-xl border border-danger/40 bg-danger/10 px-3.5 py-3 text-sm text-danger">{message}</div>
  )
}

export function Empty({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <p className="font-display text-xl text-ink">{title}</p>
      {body && <p className="max-w-xs text-sm text-ink-2">{body}</p>}
      {action}
    </div>
  )
}
