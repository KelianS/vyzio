import { appErrorDiagnostic, appErrorMessage, type AppError } from '../errors/AppError'
import { cn } from '../ui/utils'

/** The line support reads under an error: quiet, monospace, selectable to be copied (SPECS 1.5). */
export function DiagnosticLine({ text }: { text: string }) {
  return (
    <p className="mt-1 font-mono text-xs break-all text-muted-foreground select-text">{text}</p>
  )
}

/** An error shown in place: the sentence for the user, the line under it for support. */
export function ErrorMessage({ error, className }: { error: AppError; className?: string }) {
  const diagnostic = appErrorDiagnostic(error)
  return (
    <div role="alert" className={cn('text-sm text-destructive', className)}>
      <p>{appErrorMessage(error)}</p>
      {diagnostic && <DiagnosticLine text={diagnostic} />}
    </div>
  )
}
