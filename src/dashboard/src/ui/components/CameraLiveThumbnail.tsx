import { useEffect, useRef, useState } from 'react'
import type { Camera } from '../../domain/entities/Camera'

interface CameraLiveThumbnailProps {
  camera: Camera
  apiBaseUrl: string
  onExpand?: () => void
  onTogglePrivacy?: (camera: Camera, active: boolean) => void
}

export function CameraLiveThumbnail({ camera, apiBaseUrl, onExpand, onTogglePrivacy }: CameraLiveThumbnailProps) {
  const [imgSrc, setImgSrc] = useState(
    () => `${apiBaseUrl}/api/cameras/${camera.id}/live/latest.jpg?t=${Date.now()}`,
  )
  const [offline, setOffline] = useState(() => !camera.connected)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOffline(!camera.connected)

    if (!camera.privacyModeActive && camera.connected) {
      intervalRef.current = setInterval(() => {
        setImgSrc(
          `${apiBaseUrl}/api/cameras/${camera.id}/live/latest.jpg?t=${Date.now()}`,
        )
      }, 1000)
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [camera.id, camera.privacyModeActive, camera.connected, apiBaseUrl])

  const handleTogglePrivacy = (e: React.MouseEvent) => {
    e.stopPropagation()
    onTogglePrivacy?.(camera, !camera.privacyModeActive)
  }

  return (
    <article
      className={`live-thumb${offline ? ' live-thumb--offline' : ''}${camera.privacyModeActive ? (camera.privacyVendorCut ? ' live-thumb--privacy-hw' : ' live-thumb--privacy') : ''}${onExpand && !camera.privacyModeActive ? ' live-thumb--expandable' : ''}`}
      onClick={camera.privacyModeActive ? undefined : onExpand}
      role={onExpand && !camera.privacyModeActive ? 'button' : undefined}
      tabIndex={onExpand && !camera.privacyModeActive ? 0 : undefined}
      onKeyDown={onExpand && !camera.privacyModeActive ? (e) => { if (e.key === 'Enter' || e.key === ' ') onExpand() } : undefined}
    >
      <div className="live-thumb-frame">
        {camera.privacyModeActive ? (
          <div className={`live-thumb-privacy-screen${camera.privacyVendorCut ? ' live-thumb-privacy-screen--hw' : ''}`}>
            <span className="live-thumb-privacy-icon" aria-hidden="true">
              {camera.privacyVendorCut ? '🔒' : '🔇'}
            </span>
            <span className="live-thumb-privacy-label">
              {camera.privacyVendorCut ? 'Caméra coupée — matériel' : 'Caméra en pause — enregistrement désactivé'}
            </span>
          </div>
        ) : offline ? (
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
        {camera.privacyModeActive ? (
          <span className={`live-dot${camera.privacyVendorCut ? ' live-dot--privacy-hw' : ' live-dot--privacy'}`} aria-hidden="true" />
        ) : (
          <span className={`live-dot${offline ? '' : ' live-dot--on'}`} aria-hidden="true" />
        )}
        <span className="live-thumb-name">{camera.displayName}</span>
        {camera.privacyModeSource === 'schedule' && (
          <span className="live-thumb-badge live-thumb-badge--schedule" title="Activé par planification">planifié</span>
        )}
        {onTogglePrivacy && (
          <button
            type="button"
            className={`live-thumb-privacy-btn${camera.privacyModeActive ? ' live-thumb-privacy-btn--active' : ''}`}
            onClick={handleTogglePrivacy}
            title={camera.privacyModeActive ? 'Désactiver le mode vie privée' : 'Activer le mode vie privée'}
          >
            {camera.privacyModeActive ? 'Réactiver' : 'Pause'}
          </button>
        )}
      </div>
    </article>
  )
}
