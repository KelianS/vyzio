import { useCallback, useEffect, useState } from 'react'
import type { GetPtzPresets } from '../../domain/usecases/GetPtzPresets'
import type { PtzCalibrate } from '../../domain/usecases/PtzCalibrate'
import type { PtzStep } from '../../domain/usecases/PtzStep'
import type { PtzGoToPreset } from '../../domain/usecases/PtzGoToPreset'
import type { PtzSaveCurrentAsPreset } from '../../domain/usecases/PtzSaveCurrentAsPreset'
import type { CapturePtzPresetThumbnail } from '../../domain/usecases/CapturePtzPresetThumbnail'
import type { FrigateStatus } from '../../domain/entities/SystemStats'
import { toAppError } from '../../common/errors/toAppError'
import { appErrorMessage } from '../../common/errors/AppError'
import { useToast } from '../../common/components/Toast'
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

/** Presets are set from the live view (see `PtzControlPanel`); this keeps only calibration and the door into it. */
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
  const { toast } = useToast()
  const [calibrated, setCalibrated] = useState(true)
  const [currentPosition, setCurrentPosition] = useState<{ x: number; y: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [calibrating, setCalibrating] = useState(false)
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
    return () => {
      cancelled = true
    }
  }, [cameraId, getPtzPresets])

  const handleCalibrate = useCallback(async () => {
    setCalibrating(true)
    try {
      await ptzCalibrate.execute(cameraId)
      setCalibrated(true)
      setCurrentPosition({ x: 0, y: 0 })
      toast(
        'Calibration terminée — la caméra est à la position 0. Ouvrez la vue live pour définir les positions.',
        'success',
      )
    } catch (e) {
      toast(appErrorMessage(toAppError(e)), 'error')
    } finally {
      setCalibrating(false)
    }
  }, [cameraId, ptzCalibrate, toast])

  return (
    <div className="flex flex-col gap-3">
      {loading && <p className="text-muted-foreground">Chargement…</p>}
      {error && <p className="text-destructive">{error}</p>}

      {!loading && !error && (
        <>
          {calibrated && currentPosition && (
            <span className="text-sm text-muted-foreground">
              Position actuelle : {currentPosition.x}, {currentPosition.y}
            </span>
          )}

          {!calibrated && (
            <div className="flex flex-col gap-2 rounded-inset border border-border bg-muted/40 p-3">
              <p className="text-sm text-muted-foreground">
                Calibrez la caméra pour établir la position de référence (butée mécanique), puis
                ouvrez la vue live pour définir les positions.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="self-start"
                disabled={calibrating}
                onClick={handleCalibrate}
              >
                {calibrating ? 'Calibration en cours…' : 'Calibrer (position 0)'}
              </Button>
            </div>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() => setLiveViewOpen(true)}
          >
            Configurer les positions
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
          />
        </Overlay>
      )}
    </div>
  )
}
