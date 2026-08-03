import type { ReactNode } from 'react'
import { Badge as BadgePrimitive } from '../ui/badge'
import { cn } from '../ui/utils'

/** State badge, built on the shadcn primitive (ADR-42); tone is background-only so text stays readable on any surface. */
export type BadgeTone = 'ok' | 'warn' | 'danger' | 'neutral'

const TONE_CLASS: Record<BadgeTone, string> = {
  ok: 'bg-success/20 text-foreground',
  warn: 'bg-accent text-accent-foreground',
  danger: 'bg-destructive/20 text-foreground',
  neutral: 'bg-muted text-muted-foreground',
}

export function Badge({
  tone = 'neutral',
  className,
  children,
}: {
  tone?: BadgeTone
  className?: string
  children: ReactNode
}) {
  return (
    <BadgePrimitive variant="default" className={cn(TONE_CLASS[tone], className)}>
      {children}
    </BadgePrimitive>
  )
}
