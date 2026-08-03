import type { ReactNode } from 'react'
import { Badge as BadgePrimitive } from '../ui/badge'
import { cn } from '../ui/utils'

/**
 * Pastille d'etat : une **qualification**, jamais une action (DESIGN SYSTEM,
 * regle de forme pilule vs rectangle). Batie sur la primitive shadcn/ui
 * (ADR-42) plutot que redessinee a la main.
 *
 * Le texte reste `foreground` et seule la teinte de fond porte le ton : c'est
 * ce qui garantit le contraste sur une surface claire comme sombre. Les
 * anciennes pastilles peignaient le texte en clair — invisible des qu'elles
 * ont quitte les panneaux sombres.
 */
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
