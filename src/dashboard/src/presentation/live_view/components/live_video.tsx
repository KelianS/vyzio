import { useEffect, useRef, useState } from 'react'
import { Volume2, VolumeX } from 'lucide-react'
import { cn } from '../../../common/ui/utils'
import { Button } from '../../../common/ui/button'
import { DiagnosticLine } from '../../../common/components/error_message'
import { liveWaitMessage } from '../../../common/components/live_frame'
import { LiveWaitVeil } from '../../../common/components/live_wait_veil'
import { LiveQuality } from '../../../domain/entities/camera.entity'
import type { LiveFailure, LivePlayback } from '../../../domain/entities/live_playback.entity'
import type { FrigateStatus } from '../../../domain/entities/system_stats.entity'
import { LiveImage } from './live_image'

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
    sentence: 'Mode vie privée : la vue en direct est arrêtée.',
    frame: false,
    retry: false,
    otherQuality: false,
  },
  removed: {
    sentence: 'Cette caméra n’existe plus.',
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

// Readable over any picture: the inverse surface, dimmed.
const CONTROL =
  'inline-flex h-9 min-w-9 items-center justify-center rounded-full bg-surface-inverse/70 px-3 text-xs font-semibold text-surface-inverse-foreground'

/** The live video (ADR-72), with its quality and sound; a sentence and its way out when it cannot play. */
export function LiveVideo({
  cameraId,
  apiBaseUrl,
  label,
  frigateStatus,
  quality,
  qualities,
  soundOn,
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
      className={cn(CONTROL, IS_HIGH[quality] && 'bg-primary text-primary-foreground')}
      aria-pressed={IS_HIGH[quality]}
      aria-label="Haute qualité"
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
        return (
          <div className="absolute right-2 bottom-2 flex gap-2">
            {playback.soundOffered && (
              <button
                type="button"
                className={CONTROL}
                aria-label={soundOn ? 'Couper le son' : 'Activer le son'}
                onClick={onToggleSound}
              >
                {soundOn ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
              </button>
            )}
            {qualitySwitch}
          </div>
        )
      case 'failed':
        return null
      default: {
        const unknown: never = playback
        return unknown
      }
    }
  }

  const failed = failureOf(playback)
  const shown = failed && FAILURES[failed.failure]
  const playing = PLAYING[playback.kind]

  return (
    <div className="flex flex-col items-center gap-2">
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
          <div className="flex w-full items-start justify-between gap-3 rounded-card bg-card p-3 text-sm text-card-foreground shadow-[var(--shadow-soft)]">
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
      <div
        className={cn(
          'relative flex items-center justify-center overflow-hidden rounded-lg bg-surface-inverse',
          failed && 'hidden',
          !playing && 'aspect-video w-[min(90vw,48rem)]',
        )}
      >
        <video
          ref={videoRef}
          aria-label={label}
          muted
          playsInline
          className={cn('block max-h-[75vh] max-w-[90vw]', !playing && 'invisible')}
        />
        {overlay()}
      </div>
    </div>
  )
}
