import type { ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'

/** The in-card fold's look, one home; its meaning belongs to the component that uses it. */
export function Fold({
  summary,
  defaultOpen,
  bodyClassName,
  children,
}: {
  summary: ReactNode
  defaultOpen?: boolean
  bodyClassName: string
  children: ReactNode
}) {
  return (
    <details open={defaultOpen} className="group mt-4 rounded-inset bg-muted/50">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-inset px-3 py-2 text-sm font-medium select-none hover:bg-muted">
        {summary}
        <ChevronRight
          className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90"
          aria-hidden="true"
        />
      </summary>
      <div className={bodyClassName}>{children}</div>
    </details>
  )
}
