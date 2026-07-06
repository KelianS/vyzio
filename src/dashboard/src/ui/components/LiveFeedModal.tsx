import { useEffect, useRef, useState } from 'react'
import type { PtzStep } from '../../application/use-cases/PtzStep'
import type { PtzGoToPreset } from '../../application/use-cases/PtzGoToPreset'
import type { GetPtzPresets } from '../../application/use-cases/GetPtzPresets'
import type { CapturePtzPresetThumbnail } from '../../application/use-cases/CapturePtzPresetThumbnail'
import type { PtzPreset } from '../../domain/entities/PtzPreset'
import { PtzControlPanel } from './PtzControlPanel'

interface LiveFeedModalProps {
  cameraId: string
  apiBaseUrl: string
  label: string
  ptzSupported: boolean
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
  ptzStep,
  ptzGoToPreset,
  getPtzPresets,
  capturePtzPresetThumbnail,
}: LiveFeedModalProps) {
  const [src, setSrc] = useState(
    () => `${apiBaseUrl}/api/cameras/${cameraId}/live/latest.jpg?t=${Date.now()}`,
  )
  const [presets, setPresets] = useState<PtzPreset[]>([])
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
      <img src={src} alt={label} className="live-feed-modal-img" />
      {ptzSupported && (
        <div className="live-feed-ptz-overlay">
          <PtzControlPanel
            cameraId={cameraId}
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
