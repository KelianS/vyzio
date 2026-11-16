import type { ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { GroupedItem } from './grouped_list'

interface HelpProps {
  title: string
  /** The task is not done yet: the help is then the main content, not a fallback. */
  defaultOpen?: boolean
  children: ReactNode
}

/** The question as a row's title, unfolding its answer in place. */
function HelpDetails({ title, defaultOpen, children }: HelpProps) {
  return (
    <details open={defaultOpen} className="group">
      <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3.5 px-4 py-2 text-row font-medium outline-none hover:bg-secondary focus-visible:bg-secondary">
        <span className="min-w-0 flex-1">{title}</span>
        <ChevronRight
          className="size-5 shrink-0 text-mark-off transition-transform group-open:rotate-90"
          aria-hidden="true"
        />
      </summary>
      <div className="space-y-3 px-4 pt-1 pb-4 text-body text-muted-foreground">{children}</div>
    </details>
  )
}

/**
 * Third level of help (ADR-17): what speaks of the task, not of a field, and so does not fit a tooltip.
 * A row of a grouped list whose title is the question the reader asks; it unfolds in place.
 */
export function HelpRow(props: HelpProps) {
  return (
    <GroupedItem>
      <HelpDetails {...props} />
    </GroupedItem>
  )
}

/** A help row standing alone, on its own surface. */
export function HelpPanel(props: HelpProps) {
  return (
    <div className="overflow-hidden rounded-card bg-card">
      <HelpDetails {...props} />
    </div>
  )
}
