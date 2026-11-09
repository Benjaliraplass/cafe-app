import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva('inline-flex items-center rounded-full px-3 py-1.5 text-xs font-normal whitespace-nowrap', {
  variants: {
    variant: {
      default: 'bg-muted text-foreground',
      outline: 'border border-border text-muted-foreground',
      solid: 'bg-primary text-primary-foreground',
    },
  },
  defaultVariants: { variant: 'default' },
})

function Badge({ className, variant, ...props }: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
