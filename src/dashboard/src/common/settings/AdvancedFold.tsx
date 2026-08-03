import type { ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'

/** `Avancé` est une position de fin de page, pas un mode (ADR-40) : un seul repli, partout le même. */
export function AdvancedFold({ lede, children }: { lede?: string; children: ReactNode }) {
  return (
    <details className="group mt-8 rounded-inset border border-border">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-inset px-4 py-3 font-medium select-none hover:bg-muted">
        <ChevronRight
          className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90"
          aria-hidden="true"
        />
        Avancé
      </summary>
      <div className="border-t border-border px-4 py-4">
        {lede && <p className="mb-3 text-sm text-muted-foreground">{lede}</p>}
        {children}
      </div>
    </details>
  )
}
