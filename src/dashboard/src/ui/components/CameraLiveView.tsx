import { useEffect, useState } from 'react'

interface CameraLiveViewProps {
  cameraId: string
  apiBaseUrl: string
}

export function CameraLiveView({ cameraId, apiBaseUrl }: CameraLiveViewProps) {
  const [src, setSrc] = useState(
    () => `${apiBaseUrl}/api/cameras/${cameraId}/live/latest.jpg?t=${Date.now()}`,
  )

  useEffect(() => {
    const id = setInterval(() => {
      setSrc(`${apiBaseUrl}/api/cameras/${cameraId}/live/latest.jpg?t=${Date.now()}`)
    }, 1000)
    return () => clearInterval(id)
  }, [cameraId, apiBaseUrl])

  return (
    <img
      src={src}
      alt="Flux live"
      className="camera-live-view-img"
    />
  )
}
