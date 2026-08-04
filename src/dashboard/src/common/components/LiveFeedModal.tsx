import { useEffect, useRef, useState } from 'react'
import { cn } from '../ui/utils'
import type { PtzStep } from '../../domain/usecases/PtzStep'
import type { PtzGoToPreset } from '../../domain/usecases/PtzGoToPreset'
import type { GetPtzPresets } from '../../domain/usecases/GetPtzPresets'
import type { PtzSaveCurrentAsPreset } from '../../domain/usecases/PtzSaveCurrentAsPreset'
import type { CapturePtzPresetThumbnail } from '../../domain/usecases/CapturePtzPresetThumbnail'
import type { PtzCalibrate } from '../../domain/usecases/PtzCalibrate'
import type { FrigateStatus } from '../../domain/entities/SystemStats'
import { PtzControlPanel } from './PtzControlPanel'

interface LiveFeedModalProps {
  cameraId: string
  apiBaseUrl: string
  label: string
  ptzSupported: boolean
  frigateStatus?: FrigateStatus
  ptzStep: PtzStep
  ptzGoToPreset: PtzGoToPreset
  getPtzPresets?: GetPtzPresets
  ptzSaveCurrentAsPreset?: PtzSaveCurrentAsPreset
  capturePtzPresetThumbnail?: CapturePtzPresetThumbnail
  ptzCalibrate?: PtzCalibrate
}

export function LiveFeedModal({
  cameraId,
  apiBaseUrl,
  label,
  ptzSupported,
  frigateStatus = 'active',
  ptzStep,
  ptzGoToPreset,
  getPtzPresets,
  ptzSaveCurrentAsPreset,
  capturePtzPresetThumbnail,
  ptzCalibrate,
}: LiveFeedModalProps) {
  const [src, setSrc] = useState(
    () => `${apiBaseUrl}/api/cameras/${cameraId}/live/latest.jpg?t=${Date.now()}`,
  )
  const [imageError, setImageError] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setSrc(`${apiBaseUrl}/api/cameras/${cameraId}/live/latest.jpg?t=${Date.now()}`)
    }, 1000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [cameraId, apiBaseUrl])

  const waiting = frigateStatus === 'restarting' || imageError

  return (
    <div className="flex max-w-[90vw] flex-col items-center gap-3">
      {/* Une image sans donnees perd ses dimensions : sans plancher, le voile d'attente se
          reduisait a un timbre-poste portant l'icone de rupture du navigateur. */}
      <div
        className={cn(
          'relative flex items-center justify-center overflow-hidden rounded-lg',
          waiting && 'aspect-video w-[min(90vw,48rem)] bg-surface-inverse',
        )}
      >
        <img
          src={src}
          alt={label}
          className={cn('block max-h-[75vh] max-w-[90vw] rounded-lg', waiting && 'invisible')}
          onError={() => setImageError(true)}
          onLoad={() => setImageError(false)}
        />
        {waiting && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <span
              className="size-6 animate-spin rounded-full border-2 border-surface-inverse-foreground/30 border-t-surface-inverse-foreground"
              aria-hidden="true"
            />
            <span className="text-sm text-surface-inverse-foreground">
              {frigateStatus === 'restarting' ? 'Redémarrage en cours…' : 'Reconnexion…'}
            </span>
          </div>
        )}
      </div>

      {/* Below the image, not overlaid: stacking both on the video crowded a phone in portrait. */}
      {ptzSupported && (
        <div className="w-full max-w-full overflow-x-auto rounded-card bg-card p-3 text-card-foreground shadow-[var(--shadow-soft)]">
          <PtzControlPanel
            cameraId={cameraId}
            apiBaseUrl={apiBaseUrl}
            ptzStep={ptzStep}
            ptzGoToPreset={ptzGoToPreset}
            getPtzPresets={getPtzPresets}
            ptzSaveCurrentAsPreset={ptzSaveCurrentAsPreset}
            compact
            capturePtzPresetThumbnail={capturePtzPresetThumbnail}
            ptzCalibrate={ptzCalibrate}
          />
        </div>
      )}
    </div>
  )
}
