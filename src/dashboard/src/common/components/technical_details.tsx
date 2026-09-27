import { useEffect, useRef, type ReactNode } from 'react'
import { Fold } from './fold'

/** Figures for support at the end of a card (DESIGN SYSTEM § Technical details). */
export function TechnicalDetails({ inFault, children }: { inFault: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null)

  // Opens on a fault but never closes by itself: the user may be reading it when the fault clears.
  useEffect(() => {
    if (inFault && ref.current) ref.current.open = true
  }, [inFault])

  return (
    <Fold ref={ref} summary="Détails techniques" bodyClassName="px-3 pt-1 pb-3 text-sm">
      {children}
    </Fold>
  )
}
