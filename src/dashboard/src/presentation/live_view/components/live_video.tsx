import { useEffect, useReducer, useRef, useState, type ReactNode } from 'react'
import { RotateCw, Volume2, VolumeX } from 'lucide-react'
import { cn } from '../../../common/ui/utils'
import { DiagnosticLine } from '../../../common/components/error_message'
import { liveWaitMessage } from '../../../common/components/live_frame'
import { LiveWaitVeil } from '../../../common/components/live_wait_veil'
import { LiveQuality } from '../../../domain/entities/camera.entity'
import {
  MAY_PASS,
  type LiveFailure,
  type LivePlayback,
} from '../../../domain/entities/live_playback.entity'
import type { FrigateStatus } from '../../../domain/entities/system_stats.entity'
import { CAMERA_REMOVED, PRIVACY_STOPS_LIVE } from '../live_view.formatters'
import { LiveImage } from './live_image'
import { LIVE_CONTROL } from './live_control'
import { PressableControl } from '../../../common/components/pressable'
import { SecondaryButton } from '../../../common/components/secondary_button'

const RECONNECT_MS = 2000
// A camera that no longer answers is tried again less and less often, never further apart than this.
const MAX_RETRY_MS = 15_000

const CAMERA_LOST = 'Cette caméra ne répond plus : la vidéo reprendra dès son retour.'

/** What each failure says, and the way out it offers (ADR-07). */
const FAILURES: Record<LiveFailure, { sentence: string; frame: boolean; otherQuality: boolean }> = {
  unsupported_browser: {
    sentence: 'Ce navigateur ne lit pas la vidéo en direct : image rafraîchie chaque seconde.',
    frame: true,
    otherQuality: false,
  },
  unsupported_codec: {
    sentence:
      'Ce navigateur ne lit pas la vidéo de cette qualité : image rafraîchie chaque seconde.',
    frame: true,
    otherQuality: true,
  },
  unreachable: {
    sentence: 'La vidéo n’arrive pas : image rafraîchie chaque seconde.',
    frame: true,
    otherQuality: true,
  },
  no_quality: {
    sentence: 'Cette qualité n’est plus proposée : image rafraîchie chaque seconde.',
    frame: true,
    otherQuality: true,
  },
  privacy: {
    sentence: PRIVACY_STOPS_LIVE,
    frame: false,
    otherQuality: false,
  },
  removed: {
    sentence: CAMERA_REMOVED,
    frame: false,
    otherQuality: false,
  },
}

const OTHER_QUALITY: Record<LiveQuality, LiveQuality> = {
  [LiveQuality.Low]: LiveQuality.High,
  [LiveQuality.High]: LiveQuality.Low,
}

const IS_HIGH: Record<LiveQuality, boolean> = {
  [LiveQuality.Low]: false,
  [LiveQuality.High]: true,
}

type PlaybackKind = LivePlayback['kind']

const PLAYING: Record<PlaybackKind, boolean> = {
  connecting: false,
  playing: true,
  interrupted: false,
  stalled: false,
  failed: false,
}

/** The playback, and since when the camera no longer answers: its last diagnostic and the retries since. */
interface Watched {
  playback: LivePlayback
  lost: { diagnostic: string; retries: number } | null
}

// Kept from the stall until the picture comes back, so the attempts in between never show.
function follow(watched: Watched, playback: LivePlayback): Watched {
  switch (playback.kind) {
    case 'stalled':
      return { playback, lost: { diagnostic: playback.diagnostic, retries: 0 } }
    case 'playing':
      return { playback, lost: null }
    case 'connecting':
    case 'interrupted':
      return { playback, lost: watched.lost }
    case 'failed':
      return {
        playback,
        lost:
          watched.lost && MAY_PASS[playback.failure]
            ? { diagnostic: playback.diagnostic, retries: watched.lost.retries + 1 }
            : null,
      }
    default: {
      const unknown: never = playback
      return unknown
    }
  }
}

/** When the stream is opened again on its own, if it is: a lost camera at 2, 4, 8 s, then every 15 s. */
function retryDelay({ playback, lost }: Watched): number | null {
  switch (playback.kind) {
    case 'interrupted':
      return RECONNECT_MS
    case 'stalled':
    case 'failed':
      return lost ? Math.min(RECONNECT_MS * 2 ** lost.retries, MAX_RETRY_MS) : null
    case 'connecting':
    case 'playing':
      return null
    default: {
      const unknown: never = playback
      return unknown
    }
  }
}

function failureOf(playback: LivePlayback): { failure: LiveFailure; diagnostic: string } | null {
  switch (playback.kind) {
    case 'failed':
      return playback
    case 'connecting':
    case 'playing':
    case 'interrupted':
    case 'stalled':
      return null
    default: {
      const unknown: never = playback
      return unknown
    }
  }
}

// Upright the picture's controls hold its bottom; full screen keeps it for the positions and the pad.
function noticePlace(immersive: boolean): string {
  return immersive
    ? 'top-18 left-[max(1rem,env(safe-area-inset-left))] max-w-md right-[max(1rem,env(safe-area-inset-right))]'
    : 'inset-x-2 top-2'
}

/** The card that says why the picture does not play, with its way out. */
function Notice({
  immersive,
  sentence,
  diagnostic,
  children,
}: {
  immersive: boolean
  sentence: string
  diagnostic: string
  children?: ReactNode
}) {
  return (
    <div
      className={cn(
        'absolute flex items-start justify-between gap-3 rounded-card bg-card p-3 text-body text-card-foreground',
        noticePlace(immersive),
      )}
    >
      <div>
        <p>{sentence}</p>
        <DiagnosticLine text={diagnostic} />
      </div>
      {children}
    </div>
  )
}

/** The live video (ADR-07) in its frame, the screen's controls laid over it, handed its quality and sound. */
export function LiveVideo({
  cameraId,
  apiBaseUrl,
  label,
  frigateStatus,
  quality,
  qualities,
  soundOn,
  immersive,
  overlay,
  onOpen,
  onChooseQuality,
  onToggleSound,
}: {
  cameraId: string
  apiBaseUrl: string
  label: string
  frigateStatus: FrigateStatus
  quality: LiveQuality
  qualities: LiveQuality[]
  soundOn: boolean
  /** Edge to edge rather than in the page, upright, in the stream's own shape (LIVE-14). */
  immersive: boolean
  /** What the screen lays over the picture, handed the picture's own controls while it plays. */
  overlay: (controls: ReactNode) => ReactNode
  onOpen: (
    video: HTMLVideoElement,
    cameraId: string,
    quality: LiveQuality,
    withSound: boolean,
    onPlayback: (playback: LivePlayback) => void,
  ) => () => void
  onChooseQuality: (quality: LiveQuality) => void
  onToggleSound: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [watched, report] = useReducer(follow, {
    playback: { kind: 'connecting' },
    lost: null,
  })
  const { playback, lost } = watched
  const [attempt, setAttempt] = useState(0)
  // The stream's own shape, once known: in the page, the frame takes it so the picture fills the width.
  const [ratio, setRatio] = useState<string | null>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const measure = () => {
      if (video.videoWidth > 0 && video.videoHeight > 0)
        setRatio(`${video.videoWidth} / ${video.videoHeight}`)
    }
    video.addEventListener('loadedmetadata', measure)
    video.addEventListener('resize', measure)
    return () => {
      video.removeEventListener('loadedmetadata', measure)
      video.removeEventListener('resize', measure)
    }
  }, [])

  // Opened again on a new quality or sound, a retry, an interruption, and when surveillance comes back from a restart.
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    report({ kind: 'connecting' })
    return onOpen(video, cameraId, quality, soundOn, report)
  }, [onOpen, cameraId, quality, soundOn, attempt, frigateStatus])

  // A quality the camera no longer offers gives way to the one it still has.
  useEffect(() => {
    if (qualities.length > 0 && !qualities.includes(quality)) onChooseQuality(qualities[0])
  }, [qualities, quality, onChooseQuality])

  useEffect(() => {
    const delay = retryDelay(watched)
    if (delay === null) return
    const retry = setTimeout(() => setAttempt((n) => n + 1), delay)
    return () => clearTimeout(retry)
  }, [watched])

  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = !soundOn
  }, [soundOn, playback])

  const qualitySwitch = qualities.length > 1 && (
    <PressableControl>
      <button
        type="button"
        className={cn(LIVE_CONTROL, IS_HIGH[quality] && 'bg-primary text-primary-foreground')}
        aria-pressed={IS_HIGH[quality]}
        aria-label="HD haute qualité"
        onClick={() => onChooseQuality(OTHER_QUALITY[quality])}
      >
        HD
      </button>
    </PressableControl>
  )

  const veil = () => {
    if (lost) {
      const restarting = liveWaitMessage(frigateStatus, false)
      return restarting ? (
        <LiveWaitVeil message={restarting} />
      ) : (
        <Notice immersive={immersive} sentence={CAMERA_LOST} diagnostic={lost.diagnostic} />
      )
    }
    switch (playback.kind) {
      case 'connecting':
        return <LiveWaitVeil message={liveWaitMessage(frigateStatus, false) ?? 'Connexion…'} />
      case 'interrupted':
        return <LiveWaitVeil message={liveWaitMessage(frigateStatus, true) ?? 'Reconnexion…'} />
      case 'playing':
      case 'stalled':
      case 'failed':
        return null
      default: {
        const unknown: never = playback
        return unknown
      }
    }
  }

  const controls = playback.kind === 'playing' && (
    <>
      {playback.soundOffered && (
        <PressableControl>
          <button
            type="button"
            className={LIVE_CONTROL}
            aria-label={soundOn ? 'Couper le son' : 'Activer le son'}
            onClick={onToggleSound}
          >
            {soundOn ? <Volume2 className="size-5" /> : <VolumeX className="size-5" />}
          </button>
        </PressableControl>
      )}
      {qualitySwitch}
    </>
  )

  const failed = lost ? null : failureOf(playback)
  const shown = failed && FAILURES[failed.failure]
  const playing = PLAYING[playback.kind]

  const media = (
    <>
      <video
        ref={videoRef}
        aria-label={label}
        muted
        playsInline
        className={cn('block size-full object-contain', (!playing || failed) && 'invisible')}
      />
      {veil()}
      {failed && shown && (
        <>
          {shown.frame && (
            <LiveImage
              cameraId={cameraId}
              apiBaseUrl={apiBaseUrl}
              label={label}
              frigateStatus={frigateStatus}
            />
          )}
          <Notice immersive={immersive} sentence={shown.sentence} diagnostic={failed.diagnostic}>
            {MAY_PASS[failed.failure] && (
              <SecondaryButton icon={RotateCw} size="sm" onClick={() => setAttempt((n) => n + 1)}>
                Réessayer
              </SecondaryButton>
            )}
            {shown.otherQuality && qualitySwitch}
          </Notice>
        </>
      )}
    </>
  )

  // One tree in both framings: the video element the stream is attached to survives a turn.
  return (
    <div
      className={cn(
        'relative overflow-hidden bg-picture',
        immersive ? 'size-full' : 'aspect-video w-full rounded-card',
      )}
      style={!immersive && ratio ? { aspectRatio: ratio } : undefined}
    >
      {media}
      {overlay(controls)}
    </div>
  )
}
