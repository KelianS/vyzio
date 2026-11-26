import { useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

const ADVANCED = 'Avancé'

/** `Avancé` is a position, not a mode (UI-09): a closed fold ending the page's settings, opening in place (UI-25). */
export function AdvancedFold({ lede, children }: { lede?: string; children: ReactNode }) {
  const [shown, setShown] = useState(false)

  return (
    <details
      open={shown}
      onToggle={(event) => setShown(event.currentTarget.open)}
      className="group/advanced"
    >
      <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3.5 rounded-card bg-card px-4 py-2 outline-none hover:bg-secondary focus-visible:bg-secondary focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset">
        <span className="min-w-0 flex-1 text-row font-medium">{ADVANCED}</span>
        <ChevronDown
          className="size-5 shrink-0 text-mark-off transition-transform group-open/advanced:rotate-180"
          aria-hidden="true"
        />
      </summary>
      {/* Drawn once opened: a closed fold holds no control a reader would meet. */}
      {shown && (
        <div className="mt-6 flex flex-col gap-6">
          {lede && <p className="mx-1 text-body text-muted-foreground">{lede}</p>}
          {children}
        </div>
      )}
    </details>
  )
}
