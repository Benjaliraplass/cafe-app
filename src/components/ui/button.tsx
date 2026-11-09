import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[14px] text-[15px] font-medium transition-[background-color,color,transform] active:scale-[0.985] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        outline: 'border border-border-strong bg-transparent text-foreground hover:bg-card',
        secondary: 'bg-card text-foreground hover:bg-muted',
        ghost: 'text-foreground hover:bg-card',
        link: 'text-foreground underline-offset-4 hover:underline',
        destructive: 'border border-destructive/40 text-destructive hover:bg-destructive/10',
      },
      size: {
        default: 'h-[54px] px-5',
        sm: 'h-10 rounded-xl px-4 text-sm',
        lg: 'h-14 px-6',
        icon: 'size-10 rounded-full',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'button'
  return <Comp data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />
}

export { Button, buttonVariants }
