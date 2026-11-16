import { RotateCw, WifiOff } from 'lucide-react'
import { DiagnosticLine } from '../../../common/components/error_message'
import { TechnicalDetails } from '../../../common/components/technical_details'
import { TopBar } from '../../../common/components/top_bar'
import { Button } from '../../../common/ui/button'
import {
  appErrorDiagnostic,
  appErrorMessage,
  type AppError,
} from '../../../common/errors/app_error'

/** Vyzio never answered since the app opened: the one error that fills the screen (UI-34). */
export function HubUnreachableScreen({
  error,
  retrying,
  onRetry,
}: {
  error: AppError
  retrying: boolean
  onRetry: () => void
}) {
  const diagnostic = appErrorDiagnostic(error)

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar home gear={false}>
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-6 py-10">
          <div className="flex flex-col items-center gap-4 text-center">
            <span className="flex size-16 items-center justify-center rounded-full bg-icon-circle text-ink-muted">
              <WifiOff className="size-7" aria-hidden="true" />
            </span>
            <h1 className="text-title font-bold">Vyzio ne répond pas</h1>
            <p className="max-w-75 text-muted-foreground">
              Vérifiez que le boîtier est allumé et que cet appareil est sur le même réseau.
            </p>
          </div>
          {/* The app retries on its own; the button only spares the wait (UI-34). */}
          <Button type="button" size="lg" disabled={retrying} onClick={onRetry}>
            <RotateCw className={retrying ? 'animate-spin' : undefined} aria-hidden="true" />
            Réessayer
          </Button>
          <TechnicalDetails>
            <p>{appErrorMessage(error)}</p>
            {diagnostic && <DiagnosticLine text={diagnostic} />}
          </TechnicalDetails>
        </main>
      </TopBar>
    </div>
  )
}
