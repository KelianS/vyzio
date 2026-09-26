import { cn } from '../ui/utils'

/** The spinner and sentence laid over a live picture that waits. */
export function LiveWaitVeil({ message, className }: { message: string; className?: string }) {
  return (
    <div
      className={cn('absolute inset-0 flex flex-col items-center justify-center gap-2', className)}
    >
      <span
        className="size-6 animate-spin rounded-full border-2 border-surface-inverse-foreground/30 border-t-surface-inverse-foreground"
        aria-hidden="true"
      />
      <span className="text-sm text-surface-inverse-foreground">{message}</span>
    </div>
  )
}
