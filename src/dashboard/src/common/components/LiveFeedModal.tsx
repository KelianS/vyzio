import { useEffect, useRef, useState } from 'react'
import type { PtzStep } from '../../domain/usecases/PtzStep'
import type { PtzGoToPreset } from '../../domain/usecases/PtzGoToPreset'
import type { GetPtzPresets } from '../../domain/usecases/GetPtzPresets'
import type { CapturePtzPresetThumbnail } from '../../domain/usecases/CapturePtzPresetThumbnail'
import type { PtzPreset } from '../../domain/entities/PtzPreset'
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
  capturePtzPresetThumbnail?: CapturePtzPresetThumbnail
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
  capturePtzPresetThumbnail,
}: LiveFeedModalProps) {
  const [src, setSrc] = useState(
    () => `${apiBaseUrl}/api/cameras/${cameraId}/live/latest.jpg?t=${Date.now()}`,
  )
  const [presets, setPresets] = useState<PtzPreset[]>([])
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

  useEffect(() => {
    if (!ptzSupported || !getPtzPresets) return
    getPtzPresets.execute(cameraId).then((data) => setPresets(data.presets ?? []))
  }, [cameraId, ptzSupported, getPtzPresets])

  return (
    <div className="flex max-w-[90vw] flex-col items-center gap-3">
      <div className="relative">
        <img
          src={src}
          alt={label}
          className="block max-h-[75vh] max-w-[90vw] rounded-lg"
          onError={() => setImageError(true)}
          onLoad={() => setImageError(false)}
        />
        {(frigateStatus === 'restarting' || imageError) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-surface-inverse/70">
            <span
              className="size-6 animate-spin rounded-full border-2 border-surface-inverse-foreground/30 border-t-surface-inverse-foreground"
              aria-hidden="true"
            />
            {frigateStatus === 'restarting' && (
              <span className="text-sm text-surface-inverse-foreground">Redémarrage en cours…</span>
            )}
          </div>
        )}
      </div>

      {/* Below the image, not overlaid on it: on a phone in portrait, stacking
          the two on the video itself crowded the frame while the space below
          it went unused. */}
      {ptzSupported && (
        <div className="w-full max-w-full overflow-x-auto rounded-card bg-card p-3 text-card-foreground shadow-[var(--shadow-soft)]">
          <PtzControlPanel
            cameraId={cameraId}
            apiBaseUrl={apiBaseUrl}
            ptzStep={ptzStep}
            ptzGoToPreset={ptzGoToPreset}
            presets={presets}
            compact
            capturePtzPresetThumbnail={capturePtzPresetThumbnail}
          />
        </div>
      )}
    </div>
  )
}
