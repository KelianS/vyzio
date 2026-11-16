import type { ReactNode } from 'react'
import { cn } from '../ui/utils'

/** A list with nothing in it (DESIGN SYSTEM § Empty and loading): one quiet sentence where its items would be, aligned with the lists' labels. */
export function EmptyState({ className, children }: { className?: string; children: ReactNode }) {
  return <p className={cn('mx-1 py-2 text-body text-muted-foreground', className)}>{children}</p>
}
