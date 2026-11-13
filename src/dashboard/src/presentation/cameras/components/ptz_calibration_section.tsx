import type { AppError } from '../../../common/errors/app_error'
import { ReadFailure } from '../../../common/components/error_message'
import { Link } from 'react-router'
import { Button } from '../../../common/ui/button'
import { POSITIONS_UNREAD } from '../cameras.formatters'

/** Says where the camera stands and opens the live view, where all control happens (PTZ-17). */
export function PtzCalibrationSection({
  loading,
  error,
  calibrated,
  liveTo,
  onRetry,
}: {
  loading: boolean
  error: AppError | null
  calibrated: boolean
  /** The live view's address: coming back mounts the tab again, which reads where the camera stands. */
  liveTo: string
  onRetry: () => void
}) {
  return (
    <div className="flex flex-col gap-3">
      {loading && <p className="text-muted-foreground">Chargement…</p>}
      {error && <ReadFailure error={error} onRetry={onRetry} subject={POSITIONS_UNREAD} />}

      {!loading && !error && (
        <>
          <span className="text-sm text-muted-foreground">
            {calibrated
              ? 'Ouvrez la vue en direct pour définir les positions de cette caméra.'
              : 'Cette caméra n’a pas encore de position de référence. Ouvrez la vue en direct pour la calibrer, puis définir ses positions.'}
          </span>

          <Button asChild variant="outline" size="sm" className="self-start">
            <Link to={liveTo}>Piloter la caméra</Link>
          </Button>
        </>
      )}
    </div>
  )
}
