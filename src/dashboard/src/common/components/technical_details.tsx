import type { ReactNode } from 'react'
import { Fold } from './fold'

/** Figures for support at the end of a card, open only when the user opens it (DESIGN SYSTEM § Technical details). */
export function TechnicalDetails({ children }: { children: ReactNode }) {
  return (
    <Fold summary="Détails techniques" bodyClassName="px-3 pt-1 pb-3 text-sm">
      {children}
    </Fold>
  )
}
