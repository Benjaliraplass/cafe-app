import * as React from 'react'
import { cn } from '@/lib/utils'

/** Píldora seleccionable (filtros, métodos, perfil de tueste). */
function Chip({
  active = false,
  className,
  ...props
}: React.ComponentProps<'button'> & { active?: boolean }) {
  return (
    <button
      type="button"
      data-slot="chip"
      aria-pressed={active}
      className={cn(
        'inline-flex h-9 items-center rounded-full border px-3.5 text-[13px] font-medium transition-colors active:scale-[0.97]',
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-transparent text-muted-foreground hover:bg-card',
        className,
      )}
      {...props}
    />
  )
}

export { Chip }
