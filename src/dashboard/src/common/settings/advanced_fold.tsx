import type { ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'

/** `Avancé` is a position at the end of the page, not a mode (UI-09): one row, the same everywhere, its content below it. */
export function AdvancedFold({ lede, children }: { lede?: string; children: ReactNode }) {
  return (
    <details className="group">
      <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3.5 rounded-card bg-card px-4 py-2 text-row font-medium outline-none hover:bg-secondary focus-visible:bg-secondary focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset">
        <span className="flex-1">Avancé</span>
        <ChevronRight
          className="size-5 shrink-0 text-mark-off transition-transform group-open:rotate-90"
          aria-hidden="true"
        />
      </summary>
      <div className="mt-6 flex flex-col gap-6">
        {lede && <p className="mx-1 text-body text-muted-foreground">{lede}</p>}
        {children}
      </div>
    </details>
  )
}
