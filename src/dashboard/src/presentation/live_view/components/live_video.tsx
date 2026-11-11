import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Volume2, VolumeX } from 'lucide-react'
import { cn } from '../../../common/ui/utils'
import { Button } from '../../../common/ui/button'
import { DiagnosticLine } from '../../../common/components/error_message'
import { liveWaitMessage } from '../../../common/components/live_frame'
import { LiveWaitVeil } from '../../../common/components/live_wait_veil'
import { LiveQuality } from '../../../domain/entities/camera.entity'
import type { LiveFailure, LivePlayback } from '../../../domain/entities/live_playback.entity'
import type { FrigateStatus } from '../../../domain/entities/system_stats.entity'
import { CAMERA_REMOVED, PRIVACY_STOPS_LIVE } from '../live_view.formatters'
import type { LiveLayout } from '../live_layout'
import { LiveImage } from './live_image'
import { LIVE_CONTROL } from './live_control'

const RECONNECT_MS = 2000

/** What each failure says, and the way out it offers (ADR-72 e). */
const FAILURES: Record<
  LiveFailure,
  { sentence: string; frame: boolean; retry: boolean; otherQuality: boolean }
> = {
  unsupported_browser: {
    sentence: 'Ce navigateur ne lit pas la vidéo en direct : image rafraîchie chaque seconde.',
    frame: true,
    retry: false,
    otherQuality: false,
  },
  unsupported_codec: {
    sentence:
      'Ce navigateur ne lit pas la vidéo de cette qualité : image rafraîchie chaque seconde.',
    frame: true,
    retry: false,
    otherQuality: true,
  },
  unreachable: {
    sentence: 'La vidéo n’arrive pas : image rafraîchie chaque seconde.',
    frame: true,
    retry: true,
    otherQuality: true,
  },
  no_quality: {
    sentence: 'Cette qualité n’est plus proposée : image rafraîchie chaque seconde.',
    frame: true,
    retry: false,
    otherQuality: true,
  },
  privacy: {
    sentence: PRIVACY_STOPS_LIVE,
    frame: false,
    retry: false,
    otherQuality: false,
  },
  removed: {
    sentence: CAMERA_REMOVED,
    frame: false,
    retry: false,
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
  failed: false,
}

const RETRIES: Record<PlaybackKind, boolean> = {
  connecting: false,
  playing: false,
  interrupted: true,
  failed: false,
}

function failureOf(playback: LivePlayback): { failure: LiveFailure; diagnostic: string } | null {
  switch (playback.kind) {
    case 'failed':
      return playback
    case 'connecting':
    case 'playing':
    case 'interrupted':
      return null
    default: {
      const unknown: never = playback
      return unknown
    }
  }
}

// Landscape keeps the bottom for the positions: the reason goes under the bar, never faded.
const NOTICE_PLACE: Record<LiveLayout, string> = {
  portrait: 'inset-x-2 bottom-2',
  landscape:
    'top-16 left-[max(0.5rem,env(safe-area-inset-left))] max-w-md right-[max(0.5rem,env(safe-area-inset-right))]',
  wide: 'inset-x-4 bottom-4 mx-auto max-w-2xl',
}

/** The live video (ADR-72), filling its frame; its quality and sound go in the bar laid over it. */
export function LiveVideo({
  cameraId,
  apiBaseUrl,
  label,
  frigateStatus,
  quality,
  qualities,
  soundOn,
  layout,
  bar,
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
  layout: LiveLayout
  /** The bar over the picture, handed the picture's own controls while it plays. */
  bar: (controls: ReactNode) => ReactNode
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
  const [playback, setPlayback] = useState<LivePlayback>({ kind: 'connecting' })
  const [attempt, setAttempt] = useState(0)

  // Opened again on a new quality or sound, a retry, an interruption, and when surveillance comes back from a restart.
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    setPlayback({ kind: 'connecting' })
    return onOpen(video, cameraId, quality, soundOn, setPlayback)
  }, [onOpen, cameraId, quality, soundOn, attempt, frigateStatus])

  // A quality the camera no longer offers gives way to the one it still has.
  useEffect(() => {
    if (qualities.length > 0 && !qualities.includes(quality)) onChooseQuality(qualities[0])
  }, [qualities, quality, onChooseQuality])

  useEffect(() => {
    if (!RETRIES[playback.kind]) return
    const retry = setTimeout(() => setAttempt((n) => n + 1), RECONNECT_MS)
    return () => clearTimeout(retry)
  }, [playback])

  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = !soundOn
  }, [soundOn, playback])

  const qualitySwitch = qualities.length > 1 && (
    <button
      type="button"
      className={cn(LIVE_CONTROL, IS_HIGH[quality] && 'bg-primary text-primary-foreground')}
      aria-pressed={IS_HIGH[quality]}
      aria-label="HD haute qualité"
      onClick={() => onChooseQuality(OTHER_QUALITY[quality])}
    >
      HD
    </button>
  )

  const overlay = () => {
    switch (playback.kind) {
      case 'connecting':
        return <LiveWaitVeil message={liveWaitMessage(frigateStatus, false) ?? 'Connexion…'} />
      case 'interrupted':
        return <LiveWaitVeil message={liveWaitMessage(frigateStatus, true) ?? 'Reconnexion…'} />
      case 'playing':
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
        <button
          type="button"
          className={LIVE_CONTROL}
          aria-label={soundOn ? 'Couper le son' : 'Activer le son'}
          onClick={onToggleSound}
        >
          {soundOn ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
        </button>
      )}
      {qualitySwitch}
    </>
  )

  const failed = failureOf(playback)
  const shown = failed && FAILURES[failed.failure]
  const playing = PLAYING[playback.kind]

  return (
    <div className="relative size-full overflow-hidden bg-surface-inverse">
      <video
        ref={videoRef}
        aria-label={label}
        muted
        playsInline
        className={cn('block size-full object-contain', (!playing || failed) && 'invisible')}
      />
      {overlay()}
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
          <div
            className={cn(
              'absolute flex items-start justify-between gap-3 rounded-card bg-card p-3 text-sm text-card-foreground shadow-[var(--shadow-soft)]',
              NOTICE_PLACE[layout],
            )}
          >
            <div>
              <p>{shown.sentence}</p>
              <DiagnosticLine text={failed.diagnostic} />
            </div>
            {shown.retry && (
              <Button variant="outline" size="sm" onClick={() => setAttempt((n) => n + 1)}>
                Réessayer
              </Button>
            )}
            {shown.otherQuality && qualitySwitch}
          </div>
        </>
      )}
      {bar(controls)}
    </div>
  )
}
