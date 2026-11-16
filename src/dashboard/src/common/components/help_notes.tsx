import type { ReactNode } from 'react'
import { CircleHelp } from 'lucide-react'

/**
 * Third level of help (ADR-17): what speaks of the task, not of a field, and so does not fit a tooltip.
 * A page's questions, together after its content, read as a footnote (DESIGN SYSTEM § Help).
 */
export function HelpNotes({ children }: { children: ReactNode }) {
  return (
    <section aria-label="Aide" className="flex flex-col">
      {children}
    </section>
  )
}

/** The question the reader asks, quiet as a footnote, unfolding its answer in place under its text. */
export function HelpQuestion({
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
    <details open={defaultOpen}>
      <summary className="flex min-h-11 cursor-pointer list-none items-start gap-2 rounded-md px-1 py-2.75 text-body text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset [&::-webkit-details-marker]:hidden">
        <CircleHelp className="mt-0.75 size-4 shrink-0" aria-hidden="true" />
        <span className="min-w-0">{title}</span>
      </summary>
      <div className="space-y-3 pr-1 pb-3 pl-7 text-body text-muted-foreground">{children}</div>
    </details>
  )
}
