import * as React from 'react'
import { cn } from '@/lib/utils'

function Card({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="card" className={cn('rounded-[20px] bg-card text-card-foreground', className)} {...props} />
}

export { Card }
