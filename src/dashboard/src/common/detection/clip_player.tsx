import { useRef, useState, type ReactNode } from 'react'
import { Pause, Play } from 'lucide-react'
import { cn } from '../ui/utils'
import { PressableControl } from '../components/pressable'
import { fading } from '../motion/fading'
import { useAutoHide } from '../motion/use_auto_hide'
import type { DetectionEvent } from '../../domain/entities/detection_event.entity'
import type { DetectionLabel } from '../../domain/entities/detection_label.entity'
import { clipUrl, formatClipDetail, formatEventTitle, snapshotUrl } from './detection_formatters'
import { DetectionTypeIcon } from './detection_type_icon'

/** Expiry is not a failure: nothing to retry, said the same in the list and in the player (HIST-17). */
const MEDIA_EXPIRED = 'Aperçu et vidéo effacés : au-delà de la durée de conservation.'

/** What the player holds when the detection has no video to play. */
function stillOf(event: DetectionEvent, clipGone: boolean): string | null {
  if (event.mediaExpired) return MEDIA_EXPIRED
  if (clipGone) return 'La vidéo de ce moment a été supprimée.'
  if (!event.hasClip && !event.hasSnapshot) return 'Cette détection n’a ni aperçu ni vidéo.'
  return null
}

/**
 * The player of a detection, in place of a picture: its video from the start, its name and hour over
 * it, how far it has played. It stops on its last frame unless the screen goes on (`onEnded`).
 * While it plays, all but the progress line fade and come back at a tap or a key (HIST-18).
 */
export function ClipPlayer({
  event,
  labels,
  apiBaseUrl,
  clipGone,
  withCamera = false,
  className,
  onVideoError,
  onEnded,
  children,
}: {
  event: DetectionEvent
  labels: readonly DetectionLabel[]
  apiBaseUrl: string
  /** The video was erased with another detection: said as such, never as a broken player (HIST-11). */
  clipGone: boolean
  /** The clips come from several cameras: the line under the name says which. */
  withCamera?: boolean
  className?: string
  onVideoError: () => void
  onEnded?: () => void
  /** What the screen lays over the player, such as the way back to the live picture. */
  children?: ReactNode
}) {
  const still = stillOf(event, clipGone)
  const video = !still && event.hasClip
  // Held by the clip it names, so the next clip starts as not yet playing.
  const [playingId, setPlayingId] = useState<string | null>(null)
  const controls = useAutoHide(video && playingId === event.eventId)
  const fade = fading(controls.shown)

  return (
    <div
      role="group"
      aria-label={`Détection : ${formatEventTitle(event, labels)}`}
      className={cn('relative overflow-hidden bg-picture', className)}
      onPointerDownCapture={controls.hold}
      onPointerUpCapture={controls.release}
      onPointerCancelCapture={controls.release}
      onFocusCapture={controls.reveal}
    >
      {video && (
        <ClipVideo
          // A new clip starts from nothing: its progress and its pause are its own.
          key={event.eventId}
          src={clipUrl(apiBaseUrl, event.eventId)}
          label={formatEventTitle(event, labels)}
          fade={fade}
          onPlayingChange={(playing) => setPlayingId(playing ? event.eventId : null)}
          onEnded={onEnded}
          onError={onVideoError}
        />
      )}
      {!still && !video && (
        <img
          src={snapshotUrl(apiBaseUrl, event.eventId)}
          alt={formatEventTitle(event, labels)}
          className="absolute inset-0 size-full object-contain"
        />
      )}
      {still && (
        <p className="absolute inset-0 flex items-center justify-center px-6 text-center text-body text-ink-muted">
          {still}
        </p>
      )}

      <div
        {...fade}
        className={cn(
          'absolute inset-x-0 bottom-0 flex items-center gap-2.5 bg-linear-to-t from-picture/80 to-transparent px-3 pt-8 pb-3',
          fade.className,
        )}
      >
        <DetectionTypeIcon label={event.label} className="size-9" />
        <div className="min-w-0">
          <p className="text-row font-semibold">{formatEventTitle(event, labels)}</p>
          <p className="text-label font-semibold text-ink-muted">
            {formatClipDetail(event, { camera: withCamera })}
          </p>
        </div>
      </div>
      {/* Static, so the screen's controls keep the player as their frame while they fade. */}
      <div {...fade}>{children}</div>
    </div>
  )
}

/** The video itself, the way to pause it, and how far it has played. */
function ClipVideo({
  src,
  label,
  fade,
  onPlayingChange,
  onEnded,
  onError,
}: {
  src: string
  label: string
  fade: ReturnType<typeof fading>
  onPlayingChange: (playing: boolean) => void
  onEnded?: () => void
  onError: () => void
}) {
  const ref = useRef<HTMLVideoElement>(null)
  const [played, setPlayed] = useState(0)
  // Until it really plays: a browser that refuses to start it alone leaves « Lire » to tap.
  const [paused, setPaused] = useState(true)
  const Icon = paused ? Play : Pause

  return (
    <>
      <video
        ref={ref}
        src={src}
        autoPlay
        playsInline
        aria-label={label}
        className="absolute inset-0 size-full object-contain"
        onTimeUpdate={(e) => {
          const { currentTime, duration } = e.currentTarget
          if (duration > 0) setPlayed(currentTime / duration)
        }}
        onPlay={() => setPaused(false)}
        // A clip waiting for its data is not playing: its controls stay while it waits.
        onPlaying={() => onPlayingChange(true)}
        onWaiting={() => onPlayingChange(false)}
        onStalled={() => onPlayingChange(false)}
        onPause={() => {
          setPaused(true)
          onPlayingChange(false)
        }}
        onEnded={() => {
          onPlayingChange(false)
          onEnded?.()
        }}
        onError={onError}
      />
      <div {...fade}>
        <PressableControl>
          <button
            type="button"
            aria-label={paused ? 'Lire' : 'Pause'}
            onClick={() => {
              if (paused) void ref.current?.play()
              else ref.current?.pause()
            }}
            className="absolute top-1/2 left-1/2 z-10 flex size-16 -translate-1/2 items-center justify-center rounded-full bg-glass outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <Icon className="size-6 fill-current" aria-hidden="true" />
          </button>
        </PressableControl>
      </div>
      <div className="absolute inset-x-0 bottom-0 z-10 h-0.75 bg-foreground/20" aria-hidden="true">
        <div className="h-full bg-foreground" style={{ width: `${played * 100}%` }} />
      </div>
    </>
  )
}
