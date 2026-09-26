import type { ReactNode } from 'react'
import { ChevronRight, HelpCircle } from 'lucide-react'

/**
 * Third level of help (ADR-53): what speaks of the task, not of a field, and so does not fit a tooltip.
 * Folded by default, attached to its section — not `AdvancedFold`, which is a page position (ADR-40).
 * The title is the question the reader is asking, never the name of a chapter.
 */
export function HelpPanel({
  title,
  defaultOpen,
  children,
}: {
  title: string
  /** The task is not done yet: the help is then the main content, not a fallback. */
  defaultOpen?: boolean
  children: ReactNode
}) {
  return (
    <details open={defaultOpen} className="group mt-4 rounded-inset bg-muted/50">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-inset px-3 py-2 text-sm font-medium select-none hover:bg-muted">
        <HelpCircle className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        {title}
        <ChevronRight
          className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90"
          aria-hidden="true"
        />
      </summary>
      <div className="space-y-3 px-3 pt-1 pb-3 text-sm text-muted-foreground">{children}</div>
    </details>
  )
}
