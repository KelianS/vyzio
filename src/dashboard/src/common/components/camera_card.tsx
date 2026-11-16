import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { ChevronRight, Eye, EyeOff, TriangleAlert, WifiOff } from 'lucide-react'
import { privacyMissLabel } from '../privacy/privacy_status'
import { cn } from '../ui/utils'
import { liveFrameUrl, liveWaitMessage } from './live_frame'
import { LiveWaitVeil } from './live_wait_veil'
import { SurveillanceEntry, cameraMark, surveillanceEntryOf } from '../camera/camera_status'
import type { Camera } from '../../domain/entities/camera.entity'
import type { FrigateStatus } from '../../domain/entities/system_stats.entity'
import { PressableControl, PressableSurface } from './pressable'
import { StatusMark } from './status_mark'

interface CameraCardProps {
  camera: Camera
  apiBaseUrl: string
  frigateStatus?: FrigateStatus
  /** Four cameras or more: the grid's smaller card (UI-32). */
  compact?: boolean
  /** A cut or a resume is under way on this camera: its eye waits. */
  busy?: boolean
  /** Where a tap on the picture leads: the camera's view. */
  liveTo: string
  onTogglePrivacy: (camera: Camera, active: boolean) => void
}

const FOCUS =
  'focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring'

/** A camera on the home: its picture, then its name, its mark and its eye (UI-32, PRIV-20). */
export function CameraCard({
  camera,
  apiBaseUrl,
  frigateStatus = 'active',
  compact = false,
  busy = false,
  liveTo,
  onTogglePrivacy,
}: CameraCardProps) {
  const deviceOffline = !camera.connected
  // Not in surveillance yet: no image to try nor view to open, the card leads to its page (ADR-04).
  const unwatched = surveillanceEntryOf(camera) !== SurveillanceEntry.Watched
  const cut = camera.privacyModeActive
  const live = !cut && !unwatched && !deviceOffline
  const missLabel = privacyMissLabel(camera)
  const name = camera.displayName

  const frame = cn(
    'flex w-full items-center justify-center bg-picture',
    live ? 'aspect-video' : compact ? 'h-25' : 'h-30',
  )

  const picture = cut ? (
    // In place of its picture, what a cut camera is (PRIV-20); no stream is tried.
    <PictureState icon={<EyeOff className="size-6" aria-hidden="true" />}>
      {compact ? null : 'Coupée'}
    </PictureState>
  ) : deviceOffline ? (
    <PictureState icon={<WifiOff className="size-6" aria-hidden="true" />}>
      {compact ? null : 'Hors ligne'}
    </PictureState>
  ) : (
    <LiveFrame camera={camera} apiBaseUrl={apiBaseUrl} frigateStatus={frigateStatus} />
  )
  // An offline camera opens no view: it would only wait for a stream that cannot come (CAM-08).
  const to = unwatched ? `/settings/cameras/${camera.id}` : !deviceOffline || cut ? liveTo : null

  return (
    // The card's one link covers it whole; the eye and the miss line sit above it.
    <article className="relative flex flex-col overflow-hidden rounded-card bg-card text-card-foreground">
      {to ? (
        <PressableSurface>
          <Link
            to={to}
            aria-label={unwatched ? `À configurer : ${name}` : name}
            className={cn(frame, "after:absolute after:inset-0 after:content-['']", FOCUS)}
          >
            <span className="relative flex size-full items-center justify-center">
              {unwatched ? (
                <span className="flex items-center gap-1 text-body font-medium text-ink-muted">
                  À configurer
                  <ChevronRight className="size-4" aria-hidden="true" />
                </span>
              ) : (
                picture
              )}
            </span>
          </Link>
        </PressableSurface>
      ) : (
        <div className={cn(frame, 'relative')}>{picture}</div>
      )}

      <div
        className={cn(
          'flex items-center justify-between gap-1',
          compact ? 'h-12 pr-0.5 pl-3' : 'h-15 pr-2 pl-4',
        )}
      >
        <p
          className={cn(
            'flex min-w-0 items-center gap-2 font-semibold',
            compact ? 'text-body' : 'text-row',
          )}
        >
          <StatusMark {...cameraMark(camera)} />
          <span className="truncate">{name}</span>
        </p>
        <PressableControl>
          <button
            type="button"
            aria-label={cut ? `Réactiver ${name}` : `Couper ${name}`}
            aria-pressed={cut}
            aria-busy={busy}
            disabled={busy}
            onClick={() => onTogglePrivacy(camera, !cut)}
            className={cn(
              'relative z-10 inline-flex size-11 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50',
              cut ? 'bg-icon-circle text-foreground' : 'text-ink-muted hover:bg-secondary',
            )}
          >
            {cut ? (
              <EyeOff className="size-5" aria-hidden="true" />
            ) : (
              <Eye className="size-5" aria-hidden="true" />
            )}
          </button>
        </PressableControl>
      </div>

      {/* A camera that did not follow says so on its card; its privacy screen says why (PRIV-05). */}
      {missLabel && (
        <Link
          to={`/settings/cameras/${camera.id}/privacy`}
          className="relative z-10 flex items-center gap-1.5 px-4 pb-3 text-label text-muted-foreground underline underline-offset-2"
        >
          <TriangleAlert className="size-3.5 shrink-0" aria-hidden="true" />
          {missLabel}
        </Link>
      )}
    </article>
  )
}

function PictureState({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className="flex flex-col items-center gap-2 text-body font-semibold text-ink-muted">
      {icon}
      {children}
    </span>
  )
}

/** The latest frame, fetched again each second while the card shows. */
function LiveFrame({
  camera,
  apiBaseUrl,
  frigateStatus,
}: {
  camera: Camera
  apiBaseUrl: string
  frigateStatus: FrigateStatus
}) {
  const [imgSrc, setImgSrc] = useState(() => liveFrameUrl(apiBaseUrl, camera.id))
  const [imageError, setImageError] = useState(false)

  useEffect(() => {
    const interval = setInterval(() => setImgSrc(liveFrameUrl(apiBaseUrl, camera.id)), 1000)
    return () => clearInterval(interval)
  }, [camera.id, apiBaseUrl])

  const waitMessage = liveWaitMessage(frigateStatus, imageError)

  return (
    <>
      <img
        src={imgSrc}
        alt=""
        // An image with no data shows the browser's broken icon: it stays hidden until it has something to show.
        className={cn('absolute inset-0 size-full object-cover', imageError && 'invisible')}
        onError={() => setImageError(true)}
        onLoad={() => setImageError(false)}
      />
      {waitMessage && <LiveWaitVeil message={waitMessage} className="bg-picture/90" />}
    </>
  )
}
