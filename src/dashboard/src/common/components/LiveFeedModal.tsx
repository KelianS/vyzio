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
    <div className="live-feed-modal">
      <img
        src={src}
        alt={label}
        className="live-feed-modal-img"
        onError={() => setImageError(true)}
        onLoad={() => setImageError(false)}
      />
      {(frigateStatus === 'restarting' || imageError) && (
        <div className="media-loading-overlay" aria-hidden="true">
          <span className="media-loading-spinner" />
          {frigateStatus === 'restarting' && (
            <span className="media-loading-label">Redémarrage en cours…</span>
          )}
        </div>
      )}
      {ptzSupported && (
        <div className="live-feed-ptz-overlay">
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
