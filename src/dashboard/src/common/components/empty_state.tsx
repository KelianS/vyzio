import type { ReactNode } from 'react'
import { cn } from '../ui/utils'

/** A list with nothing in it (DESIGN SYSTEM § Empty and loading): one quiet sentence where its items would be. */
export function EmptyState({ className, children }: { className?: string; children: ReactNode }) {
  return <p className={cn('py-2 text-sm text-muted-foreground', className)}>{children}</p>
}
