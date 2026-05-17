import { useEffect, useRef, useState } from 'react'
import type { Camera } from '../../domain/entities/Camera'

interface CameraLiveThumbnailProps {
  camera: Camera
  apiBaseUrl: string
  onExpand?: () => void
}

export function CameraLiveThumbnail({ camera, apiBaseUrl, onExpand }: CameraLiveThumbnailProps) {
  const [imgSrc, setImgSrc] = useState(
    `${apiBaseUrl}/api/cameras/${camera.id}/live/latest.jpg?t=${Date.now()}`,
  )
  const [offline, setOffline] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    setOffline(false)

    intervalRef.current = setInterval(() => {
      setImgSrc(
        `${apiBaseUrl}/api/cameras/${camera.id}/live/latest.jpg?t=${Date.now()}`,
      )
    }, 1000)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [camera.id, apiBaseUrl])

  return (
    <article
      className={`live-thumb${offline ? ' live-thumb--offline' : ''}${onExpand ? ' live-thumb--expandable' : ''}`}
      onClick={onExpand}
      role={onExpand ? 'button' : undefined}
      tabIndex={onExpand ? 0 : undefined}
      onKeyDown={onExpand ? (e) => { if (e.key === 'Enter' || e.key === ' ') onExpand() } : undefined}
    >
      <div className="live-thumb-frame">
        {offline ? (
          <div className="live-thumb-offline">Hors ligne</div>
        ) : (
          <img
            src={imgSrc}
            alt={camera.displayName}
            className="live-thumb-img"
            onError={() => setOffline(true)}
          />
        )}
      </div>
      <div className="live-thumb-footer">
        <span className={`live-dot${offline ? '' : ' live-dot--on'}`} aria-hidden="true" />
        <span className="live-thumb-name">{camera.displayName}</span>
      </div>
    </article>
  )
}
