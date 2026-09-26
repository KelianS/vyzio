import { useEffect, useState } from 'react'
import type { GetPtzPresets } from '../../domain/usecases/get_ptz_presets.use_case'
import type { PtzCalibrate } from '../../domain/usecases/ptz_calibrate.use_case'
import type { PtzStep } from '../../domain/usecases/ptz_step.use_case'
import type { PtzGoToPreset } from '../../domain/usecases/ptz_go_to_preset.use_case'
import type { PtzSaveCurrentAsPreset } from '../../domain/usecases/ptz_save_current_as_preset.use_case'
import type { CapturePtzPresetThumbnail } from '../../domain/usecases/capture_ptz_preset_thumbnail.use_case'
import type { FrigateStatus } from '../../domain/entities/system_stats.entity'
import { toAppError } from '../../common/errors/to_app_error'
import type { AppError } from '../../common/errors/app_error'
import { ErrorMessage } from '../../common/components/error_message'
import { Button } from '../../common/ui/button'
import { Overlay } from '../../common/components/overlay'
import { LiveFeedModal } from '../../common/components/live_feed_modal'

interface PtzCalibrationSectionProps {
  cameraId: string
  cameraLabel: string
  apiBaseUrl: string
  frigateStatus?: FrigateStatus
  getPtzPresets: GetPtzPresets
  ptzCalibrate: PtzCalibrate
  ptzStep: PtzStep
  ptzGoToPreset: PtzGoToPreset
  ptzSaveCurrentAsPreset: PtzSaveCurrentAsPreset
  capturePtzPresetThumbnail: CapturePtzPresetThumbnail
}

/**
 * All control happens in the live view (ADR-45), calibration included: one does not calibrate
 * a camera without seeing it. This screen says where it stands, and opens the door.
 */
export function PtzCalibrationSection({
  cameraId,
  cameraLabel,
  apiBaseUrl,
  frigateStatus = 'active',
  getPtzPresets,
  ptzCalibrate,
  ptzStep,
  ptzGoToPreset,
  ptzSaveCurrentAsPreset,
  capturePtzPresetThumbnail,
}: PtzCalibrationSectionProps) {
  const [calibrated, setCalibrated] = useState(true)
  const [currentPosition, setCurrentPosition] = useState<{ x: number; y: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<AppError | null>(null)
  const [liveViewOpen, setLiveViewOpen] = useState(false)

  // Everything runs after the first await, so switching cameras swaps the state without flashing "Chargement…".
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const data = await getPtzPresets.execute(cameraId)
        if (cancelled) return
        setCalibrated(data.calibrated ?? true)
        setCurrentPosition(data.currentPosition ?? null)
      } catch (e) {
        if (!cancelled) setError(toAppError(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    // The live view may have calibrated or moved the camera: read again when closing it.
    return () => {
      cancelled = true
    }
  }, [cameraId, getPtzPresets, liveViewOpen])

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
            onClick={() => setLiveViewOpen(true)}
          >
            Piloter la caméra
          </Button>
        </>
      )}

      {liveViewOpen && (
        <Overlay label={`Pilotage — ${cameraLabel}`} onClose={() => setLiveViewOpen(false)}>
          <LiveFeedModal
            cameraId={cameraId}
            apiBaseUrl={apiBaseUrl}
            label={cameraLabel}
            ptzSupported
            frigateStatus={frigateStatus}
            ptzStep={ptzStep}
            ptzGoToPreset={ptzGoToPreset}
            getPtzPresets={getPtzPresets}
            ptzSaveCurrentAsPreset={ptzSaveCurrentAsPreset}
            capturePtzPresetThumbnail={capturePtzPresetThumbnail}
            ptzCalibrate={ptzCalibrate}
          />
        </Overlay>
      )}
    </div>
  )
}
