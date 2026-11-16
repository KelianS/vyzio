import { cn } from '../ui/utils'
import type { StatusMarkKind, StatusMarkState } from './status_mark_state'

// The alert is a ring, not a dot: the state reads from the shape as well as the colour.
const MARK_CLASS: Record<StatusMarkKind, string> = {
  on: 'size-2 bg-success',
  off: 'size-2 bg-mark-off',
  alert: 'size-2.5 border-2 border-destructive',
}

/** The one mark beside a name, the same on every screen (DESIGN SYSTEM § Status mark). */
export function StatusMark({ kind, label, className }: StatusMarkState & { className?: string }) {
  return (
    <span
      role="img"
      aria-label={label}
      className={cn('inline-block shrink-0 rounded-full', MARK_CLASS[kind], className)}
    />
  )
}
