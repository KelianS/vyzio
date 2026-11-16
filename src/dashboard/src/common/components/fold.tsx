import { useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

/** The in-card fold's look, one home; its meaning belongs to the component that uses it. */
export function Fold({
  summary,
  defaultOpen,
  bodyClassName,
  lazy,
  children,
}: {
  summary: ReactNode
  defaultOpen?: boolean
  bodyClassName: string
  /** Draws the body only once opened: a closed fold then holds no control of its own. */
  lazy?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen ?? false)

  return (
    <details
      open={defaultOpen}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      className="group mt-4 rounded-lg bg-secondary"
    >
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg px-3 py-2 text-body font-medium hover:bg-foreground/4">
        {summary}
        <ChevronDown
          className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>
      {(!lazy || open) && <div className={bodyClassName}>{children}</div>}
    </details>
  )
}
