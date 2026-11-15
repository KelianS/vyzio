import { cn } from '../ui/utils'

/** The spinner and sentence laid over a live picture that waits. */
export function LiveWaitVeil({ message, className }: { message: string; className?: string }) {
  return (
    <div
      className={cn('absolute inset-0 flex flex-col items-center justify-center gap-2', className)}
    >
      <span
        className="size-6 animate-spin rounded-full border-2 border-ink-muted/30 border-t-ink-muted"
        aria-hidden="true"
      />
      <span className="text-body text-ink-muted">{message}</span>
    </div>
  )
}
