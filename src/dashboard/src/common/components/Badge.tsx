import type { ReactNode } from 'react'
import { cn } from '../ui/utils'

/**
 * Pastille d'etat : une **qualification**, jamais une action (DESIGN SYSTEM,
 * regle de forme pilule vs rectangle).
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
    <span
      className={cn(
        'inline-flex w-fit items-center rounded-full px-2 py-0.5 text-xs whitespace-nowrap',
        TONE_CLASS[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}
