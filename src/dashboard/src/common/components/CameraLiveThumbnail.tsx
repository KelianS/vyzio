import { useEffect, useRef, useState } from 'react'
import { WifiOff } from 'lucide-react'
import type { Camera } from '../../domain/entities/Camera'
import type { FrigateStatus } from '../../domain/entities/SystemStats'

interface CameraLiveThumbnailProps {
  camera: Camera
  apiBaseUrl: string
  frigateStatus?: FrigateStatus
  onExpand?: () => void
  onTogglePrivacy?: (camera: Camera, active: boolean) => void
}

export function CameraLiveThumbnail({
  camera,
  apiBaseUrl,
  frigateStatus = 'active',
  onExpand,
  onTogglePrivacy,
}: CameraLiveThumbnailProps) {
  const [imgSrc, setImgSrc] = useState(
    () => `${apiBaseUrl}/api/cameras/${camera.id}/live/latest.jpg?t=${Date.now()}`,
  )
  const [imageError, setImageError] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const deviceOffline = !camera.connected

  // Resets the broken-image flag whenever the camera identity/connectivity actually changes,
  // without the cascading extra render a setState-in-effect would cause (react-hooks/set-state-in-effect).
  const resetKey = `${camera.id}:${camera.privacyModeActive}:${camera.connected}:${apiBaseUrl}`
  const [prevResetKey, setPrevResetKey] = useState(resetKey)
  if (resetKey !== prevResetKey) {
    setPrevResetKey(resetKey)
    setImageError(false)
  }

  useEffect(() => {
    if (!camera.privacyModeActive && camera.connected) {
      intervalRef.current = setInterval(() => {
        setImgSrc(`${apiBaseUrl}/api/cameras/${camera.id}/live/latest.jpg?t=${Date.now()}`)
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
      className={`live-thumb${deviceOffline ? ' live-thumb--offline' : ''}${camera.privacyModeActive ? (camera.privacyVendorCut ? ' live-thumb--privacy-hw' : ' live-thumb--privacy') : ''}${onExpand && !camera.privacyModeActive ? ' live-thumb--expandable' : ''}`}
      onClick={camera.privacyModeActive ? undefined : onExpand}
      role={onExpand && !camera.privacyModeActive ? 'button' : undefined}
      tabIndex={onExpand && !camera.privacyModeActive ? 0 : undefined}
      onKeyDown={
        onExpand && !camera.privacyModeActive
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') onExpand()
            }
          : undefined
      }
    >
      <div className="live-thumb-frame">
        {camera.privacyModeActive ? (
          <div
            className={`live-thumb-privacy-screen${camera.privacyVendorCut ? ' live-thumb-privacy-screen--hw' : ''}`}
          >
            <span className="live-thumb-privacy-icon" aria-hidden="true">
              {camera.privacyVendorCut ? '🔒' : '🔇'}
            </span>
            <span className="live-thumb-privacy-label">
              {camera.privacyVendorCut
                ? 'Caméra coupée — matériel'
                : 'Caméra en pause — enregistrement désactivé'}
            </span>
          </div>
        ) : deviceOffline ? (
          // Sur le cadre sombre, le texte reste clair — mais lisible, pas a
          // demi efface comme l'ancienne pastille.
          <div className="flex h-full items-center justify-center gap-2 text-sm font-medium text-surface-inverse-foreground">
            <WifiOff className="size-4" aria-hidden="true" />
            Hors ligne
          </div>
        ) : (
          <>
            <img
              src={imgSrc}
              alt={camera.displayName}
              className="live-thumb-img"
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
          </>
        )}
      </div>
      <div className="live-thumb-footer">
        {camera.privacyModeActive ? (
          <span
            className={`live-dot${camera.privacyVendorCut ? ' live-dot--privacy-hw' : ' live-dot--privacy'}`}
            aria-hidden="true"
          />
        ) : (
          <span className={`live-dot${deviceOffline ? '' : ' live-dot--on'}`} aria-hidden="true" />
        )}
        <span className="live-thumb-name">{camera.displayName}</span>
        {camera.privacyModeSource === 'schedule' && (
          <span
            className="live-thumb-badge live-thumb-badge--schedule"
            title="Activé par planification"
          >
            planifié
          </span>
        )}
        {onTogglePrivacy && (
          <button
            type="button"
            className={`live-thumb-privacy-btn${camera.privacyModeActive ? ' live-thumb-privacy-btn--active' : ''}`}
            onClick={handleTogglePrivacy}
            title={
              camera.privacyModeActive
                ? 'Désactiver le mode vie privée'
                : 'Activer le mode vie privée'
            }
          >
            {camera.privacyModeActive ? 'Réactiver' : 'Pause'}
          </button>
        )}
      </div>
    </article>
  )
}
