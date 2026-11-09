import * as React from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Select nativo con el mismo aspecto que Input. En móvil abre el picker del
 * sistema, que es lo más cómodo para listas largas (países).
 */
function Select({ className, children, ...props }: React.ComponentProps<'select'>) {
  return (
    <div className="relative">
      <select
        data-slot="select"
        className={cn(
          'flex h-12 w-full min-w-0 appearance-none rounded-xl border border-input bg-card pr-10 pl-4 text-[15px] text-foreground outline-none transition-colors focus-visible:border-border-strong disabled:cursor-not-allowed disabled:opacity-50',
          !props.value && 'text-tertiary',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        width={16}
        height={16}
        strokeWidth={1.8}
        className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-tertiary"
      />
    </div>
  )
}

export { Select }
