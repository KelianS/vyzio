import { useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

const ADVANCED = 'Avancé'

/** `Avancé` is a position, not a mode (UI-09): a closed fold ending the page's settings, opening in place (UI-25). */
export function AdvancedFold({
  subtitle,
  open,
  onOpenChange,
  children,
}: {
  subtitle?: string
  /** Held by the page when something else on it opens the fold. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: ReactNode
}) {
  const [own, setOwn] = useState(false)
  const shown = open ?? own

  return (
    <details
      open={shown}
      onToggle={(event) => {
        const next = event.currentTarget.open
        if (next === shown) return
        setOwn(next)
        onOpenChange?.(next)
      }}
      className="group/advanced"
    >
      <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3.5 rounded-card bg-card px-4 py-2 outline-none hover:bg-secondary focus-visible:bg-secondary focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset">
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-row font-medium">{ADVANCED}</span>
          {subtitle && ' '}
          {subtitle && <span className="text-body text-muted-foreground">{subtitle}</span>}
        </span>
        <ChevronDown
          className="size-5 shrink-0 text-mark-off transition-transform group-open/advanced:rotate-180"
          aria-hidden="true"
        />
      </summary>
      {/* Drawn once opened: a closed fold holds no control a reader would meet. */}
      {shown && <div className="mt-6 flex flex-col gap-6">{children}</div>}
    </details>
  )
}
