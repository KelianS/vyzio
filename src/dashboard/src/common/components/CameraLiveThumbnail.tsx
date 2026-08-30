import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { EyeOff, Lock, WifiOff } from 'lucide-react'
import { Button } from '../ui/button'
import { cn } from '../ui/utils'
import type { Camera } from '../../domain/entities/Camera'
import type { FrigateStatus } from '../../domain/entities/SystemStats'

interface CameraLiveThumbnailProps {
  camera: Camera
  apiBaseUrl: string
  frigateStatus?: FrigateStatus
  /** A privacy toggle is under way on this camera: the wait shows here, not only in the modal. */
  busy?: boolean
  onExpand?: () => void
  onTogglePrivacy?: (camera: Camera, active: boolean) => void
}

export function CameraLiveThumbnail({
  camera,
  apiBaseUrl,
  frigateStatus = 'active',
  busy = false,
  onExpand,
  onTogglePrivacy,
}: CameraLiveThumbnailProps) {
  const [imgSrc, setImgSrc] = useState(
    () => `${apiBaseUrl}/api/cameras/${camera.id}/live/latest.jpg?t=${Date.now()}`,
  )
  const [imageError, setImageError] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const deviceOffline = !camera.connected
  const expandable = Boolean(onExpand) && !camera.privacyModeActive

  // Resets the broken-image flag on identity/connectivity change without a setState-in-effect cascade.
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

  function handleTogglePrivacy(event: MouseEvent) {
    event.stopPropagation()
    onTogglePrivacy?.(camera, !camera.privacyModeActive)
  }

  return (
    <article className="overflow-hidden rounded-card bg-card shadow-[var(--shadow-soft)]">
      {/* Only the frame is the button — the footer's privacy toggle is a real one, and nesting is invalid. */}
      <div
        className={cn('relative aspect-video bg-surface-inverse', expandable && 'cursor-pointer')}
        onClick={camera.privacyModeActive ? undefined : onExpand}
        role={expandable ? 'button' : undefined}
        // Names the frame itself: the image, hidden during an outage, took its name along.
        aria-label={expandable ? camera.displayName : undefined}
        tabIndex={expandable ? 0 : undefined}
        onKeyDown={
          expandable
            ? (event) => {
                if (event.key === 'Enter' || event.key === ' ') onExpand?.()
              }
            : undefined
        }
      >
        {camera.privacyModeActive ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-3 text-center text-surface-inverse-foreground">
            {camera.privacyVendorCut ? (
              <Lock className="size-5" aria-hidden="true" />
            ) : (
              <EyeOff className="size-5" aria-hidden="true" />
            )}
            <span className="text-sm font-medium">
              {camera.privacyVendorCut
                ? 'Caméra coupée — matériel'
                : 'Caméra en pause — enregistrement désactivé'}
            </span>
          </div>
        ) : deviceOffline ? (
          <div className="flex h-full items-center justify-center gap-2 text-sm font-medium text-surface-inverse-foreground">
            <WifiOff className="size-4" aria-hidden="true" />
            Hors ligne
          </div>
        ) : (
          <>
            <img
              src={imgSrc}
              alt={camera.displayName}
              // An image with no data shows the browser's broken icon: it shows through
              // the waiting veil, so it stays hidden until it has something to show.
              className={cn('size-full object-cover', imageError && 'invisible')}
              onError={() => setImageError(true)}
              onLoad={() => setImageError(false)}
            />
            {(frigateStatus === 'restarting' || imageError) && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-surface-inverse/90">
                <span
                  className="size-6 animate-spin rounded-full border-2 border-surface-inverse-foreground/30 border-t-surface-inverse-foreground"
                  aria-hidden="true"
                />
                <span className="text-sm text-surface-inverse-foreground">
                  {frigateStatus === 'restarting' ? 'Redémarrage en cours…' : 'Reconnexion…'}
                </span>
              </div>
            )}
          </>
        )}
      </div>

      <div className="flex items-center gap-2 p-3">
        <span
          className={cn(
            'size-2 shrink-0 rounded-full',
            camera.privacyModeActive || deviceOffline ? 'bg-muted-foreground/40' : 'bg-success',
          )}
          aria-hidden="true"
        />
        <span className="min-w-0 flex-1 truncate font-medium">{camera.displayName}</span>
        {camera.privacyModeSource === 'schedule' && (
          <span
            className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
            title="Activé par planification"
          >
            planifié
          </span>
        )}
        {onTogglePrivacy && (
          <Button
            type="button"
            variant={camera.privacyModeActive ? 'default' : 'outline'}
            size="sm"
            disabled={busy}
            onClick={handleTogglePrivacy}
            title={
              camera.privacyModeActive
                ? 'Désactiver le mode vie privée'
                : 'Activer le mode vie privée'
            }
          >
            {busy ? 'En cours…' : camera.privacyModeActive ? 'Réactiver' : 'Pause'}
          </Button>
        )}
      </div>
    </article>
  )
}
