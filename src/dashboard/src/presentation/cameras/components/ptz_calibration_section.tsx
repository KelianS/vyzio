import type { AppError } from '../../../common/errors/app_error'
import { ErrorMessage } from '../../../common/components/error_message'
import { Button } from '../../../common/ui/button'

/** Says where the camera stands and opens the live view, where all control happens (ADR-46). */
export function PtzCalibrationSection({
  loading,
  error,
  calibrated,
  currentPosition,
  onOpenLiveView,
}: {
  loading: boolean
  error: AppError | null
  calibrated: boolean
  currentPosition: { x: number; y: number } | null
  onOpenLiveView: () => void
}) {
  return (
    <div className="flex flex-col gap-3">
      {loading && <p className="text-muted-foreground">Chargement…</p>}
      {error && <ErrorMessage error={error} />}

      {!loading && !error && (
        <>
          <span className="text-sm text-muted-foreground">
            {!calibrated
              ? 'Cette caméra n’a pas encore de position de référence. Ouvrez la vue live pour la calibrer, puis définir ses positions.'
              : currentPosition
                ? `Position actuelle : ${currentPosition.x}, ${currentPosition.y}`
                : 'Ouvrez la vue live pour définir les positions de cette caméra.'}
          </span>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            onClick={onOpenLiveView}
          >
            Piloter la caméra
          </Button>
        </>
      )}
    </div>
  )
}
