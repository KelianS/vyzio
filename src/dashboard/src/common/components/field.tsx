import type { ReactNode } from 'react'
import { cn } from '../ui/utils'

/** A form field: its label above its control, in the one label style (DESIGN SYSTEM § Typography). */
export function Field({
  label,
  className,
  children,
}: {
  label: string
  className?: string
  children: ReactNode
}) {
  return (
    <label className={cn('flex flex-col gap-1.5', className)}>
      <span className="ml-1 text-label font-semibold text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}
