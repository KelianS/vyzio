import type { ReactNode } from 'react'
import { HelpCircle } from 'lucide-react'
import { Fold } from './fold'

/**
 * Third level of help (ADR-53): what speaks of the task, not of a field, and so does not fit a tooltip.
 * Folded by default, attached to its section, not `AdvancedFold`, which is a page position (ADR-40).
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
    <Fold
      defaultOpen={defaultOpen}
      summary={
        <>
          <HelpCircle className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          {title}
        </>
      }
      bodyClassName="space-y-3 px-3 pt-1 pb-3 text-sm text-muted-foreground"
    >
      {children}
    </Fold>
  )
}
