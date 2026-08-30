import { useEffect, useState } from 'react'
import type { GetPtzPresets } from '../../domain/usecases/GetPtzPresets'
import type { PtzCalibrate } from '../../domain/usecases/PtzCalibrate'
import type { PtzStep } from '../../domain/usecases/PtzStep'
import type { PtzGoToPreset } from '../../domain/usecases/PtzGoToPreset'
import type { PtzSaveCurrentAsPreset } from '../../domain/usecases/PtzSaveCurrentAsPreset'
import type { CapturePtzPresetThumbnail } from '../../domain/usecases/CapturePtzPresetThumbnail'
import type { FrigateStatus } from '../../domain/entities/SystemStats'
import { toAppError } from '../../common/errors/toAppError'
import { appErrorMessage } from '../../common/errors/AppError'
import { Button } from '../../common/ui/button'
import { Overlay } from '../../common/components/Overlay'
import { LiveFeedModal } from '../../common/components/LiveFeedModal'

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
  const [error, setError] = useState<string | null>(null)
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
        if (!cancelled) setError(appErrorMessage(toAppError(e)))
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
      {error && <p className="text-destructive">{error}</p>}

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
