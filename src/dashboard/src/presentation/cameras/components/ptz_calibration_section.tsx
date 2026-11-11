import type { AppError } from '../../../common/errors/app_error'
import { ReadFailure } from '../../../common/components/error_message'
import { Link } from 'react-router'
import { Button } from '../../../common/ui/button'
import { POSITIONS_UNREAD } from '../cameras.formatters'

/** Says where the camera stands and opens the live view, where all control happens (ADR-46). */
export function PtzCalibrationSection({
  loading,
  error,
  calibrated,
  currentPosition,
  liveTo,
  onRetry,
}: {
  loading: boolean
  error: AppError | null
  calibrated: boolean
  currentPosition: { x: number; y: number } | null
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
            {!calibrated
              ? 'Cette caméra n’a pas encore de position de référence. Ouvrez la vue live pour la calibrer, puis définir ses positions.'
              : currentPosition
                ? `Position actuelle : ${currentPosition.x}, ${currentPosition.y}`
                : 'Ouvrez la vue live pour définir les positions de cette caméra.'}
          </span>

          <Button asChild variant="outline" size="sm" className="self-start">
            <Link to={liveTo}>Piloter la caméra</Link>
          </Button>
        </>
      )}
    </div>
  )
}
