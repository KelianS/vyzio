import { scrubSecrets } from '../../common/errors/scrub_secrets'
import type { LiveQuality } from '../../domain/entities/camera.entity'
import type { LiveFailure, LivePlayback } from '../../domain/entities/live_playback.entity'
import type { LiveStreamPort } from '../../domain/ports/live_stream.port'

/** What the stream needs from the browser, so a test can stand in for it. */
export interface MseEnvironment {
  createSocket(url: string): WebSocket
  createMediaSource(): { source: MediaSource; managed: boolean } | null
  isTypeSupported(mime: string): boolean
  attach(video: HTMLVideoElement, source: MediaSource, managed: boolean): void
  pageUrl(): string
  /** Milliseconds on a steady clock. */
  now(): number
}

declare global {
  interface Window {
    /** Safari's Media Source on the iPhone, since iOS 17.1. */
    ManagedMediaSource?: typeof MediaSource
  }
}

// The codecs go2rtc may send, offered only when this browser plays them: go2rtc knows these exact strings only.
const CODECS = [
  'avc1.640029',
  'avc1.64002A',
  'avc1.640033',
  'hvc1.1.6.L153.B0',
  'mp4a.40.2',
  'mp4a.40.5',
  'flac',
  'opus',
]
// go2rtc names every H.265 stream by its one string; a browser refusing that level may still play a lower one.
const H265_TOKEN = 'hvc1.1.6.L153.B0'
const H265_LEVELS = [H265_TOKEN, 'hvc1.1.6.L120.90', 'hvc1.1.6.L93.B0', 'hev1.1.6.L93.B0']

function h265Playable(isTypeSupported: (mime: string) => boolean): string | undefined {
  return H265_LEVELS.find((codec) => isTypeSupported(`video/mp4; codecs="${codec}"`))
}
const CODECS_NOT_MATCHED = /codecs not matched/
const VIDEO_CODEC = /^(avc1|hvc1|hev1)\b/
const AUDIO_CODEC = /^(mp4a|flac|opus)\b/

// The refusals the API closes with (ADR-72 b); any other close is a stream that did not arrive.
const CLOSE_FAILURES: Partial<Record<number, LiveFailure>> = {
  4404: 'removed',
  4409: 'privacy',
  4422: 'no_quality',
  4503: 'unreachable',
}

const FIRST_SEGMENT_MS = 10_000
// Behind by more than this, the player jumps back to the live edge rather than replaying the past.
const MAX_LAG_S = 1.5
const LIVE_EDGE_S = 0.3
const KEPT_BUFFER_S = 10
// The picture falling this far behind the clock means the sound held it back: the stream is opened again.
const MAX_DRIFT_S = 2.5

/** The socket address of a camera's live stream, on the same host as the page. */
export function liveStreamUrl(
  apiBaseUrl: string,
  cameraId: string,
  quality: LiveQuality,
  pageUrl: string,
): string {
  const url = new URL(`${apiBaseUrl}/api/cameras/${encodeURIComponent(cameraId)}/live/ws`, pageUrl)
  url.protocol = url.protocol.replace('http', 'ws')
  url.searchParams.set('quality', quality)
  return url.toString()
}

/** The codecs this browser plays among those go2rtc may send. */
export function playableCodecs(isTypeSupported: (mime: string) => boolean): string[] {
  const h265 = h265Playable(isTypeSupported)
  return CODECS.filter((codec) =>
    codec === H265_TOKEN ? h265 !== undefined : isTypeSupported(`video/mp4; codecs="${codec}"`),
  )
}

/** go2rtc's answer, its H.265 string swapped for one this browser accepts. */
export function playableMime(mime: string, isTypeSupported: (mime: string) => boolean): string {
  const h265 = h265Playable(isTypeSupported)
  return h265 ? mime.replace(H265_TOKEN, h265) : mime
}

/** The tracks go2rtc announced in the MIME type it answered. */
export function tracksOf(mime: string): { video: boolean; audio: boolean } {
  const codecs = (/codecs="([^"]*)"/.exec(mime)?.[1] ?? '').split(',').map((codec) => codec.trim())
  return {
    video: codecs.some((codec) => VIDEO_CODEC.test(codec)),
    audio: codecs.some((codec) => AUDIO_CODEC.test(codec)),
  }
}

export function failureOfClose(code: number): LiveFailure {
  return CLOSE_FAILURES[code] ?? 'unreachable'
}

// Read at each call, so a source the page gains later is still found.
function mediaSourceType(): typeof MediaSource | undefined {
  return window.ManagedMediaSource ?? (typeof MediaSource === 'undefined' ? undefined : MediaSource)
}

function browserEnvironment(): MseEnvironment {
  return {
    createSocket: (url) => new WebSocket(url),
    createMediaSource: () => {
      const Source = mediaSourceType()
      return Source ? { source: new Source(), managed: Source === window.ManagedMediaSource } : null
    },
    isTypeSupported: (mime) => mediaSourceType()?.isTypeSupported(mime) ?? false,
    attach: (video, source, managed) => {
      // Safari plays a managed source only with remote playback off, and attached as an object.
      if (managed) {
        video.disableRemotePlayback = true
        video.srcObject = source
      } else {
        video.src = URL.createObjectURL(source)
      }
    },
    pageUrl: () => window.location.href,
    now: () => performance.now(),
  }
}

interface Go2rtcMessage {
  type: string
  value: string
}

function parseMessage(text: string): Go2rtcMessage | null {
  try {
    return JSON.parse(text) as Go2rtcMessage
  } catch {
    return null
  }
}

/** go2rtc's MSE stream, through the API's live socket (ADR-72). */
export class MseLiveStream implements LiveStreamPort {
  constructor(
    private readonly apiBaseUrl: string,
    private readonly env: MseEnvironment = browserEnvironment(),
  ) {}

  open(
    video: HTMLVideoElement,
    cameraId: string,
    quality: LiveQuality,
    withSound: boolean,
    onPlayback: (playback: LivePlayback) => void,
  ): () => void {
    // A browser that fails to decode the camera's sound gets the same stream once more, video only.
    let stop = this.start(video, cameraId, quality, withSound, onPlayback, () => {
      stop = this.start(video, cameraId, quality, false, onPlayback, null)
    })
    return () => stop()
  }

  // Sound only on demand: a camera that pauses its sound while it moves would freeze the picture, both tracks sharing one buffer.
  private start(
    video: HTMLVideoElement,
    cameraId: string,
    quality: LiveQuality,
    withSound: boolean,
    onPlayback: (playback: LivePlayback) => void,
    retryWithoutAudio: (() => void) | null,
  ): () => void {
    const { env } = this
    // The line support reads under the sentence: which stream was asked, and what answered (SPECS 1.5).
    const failed = (failure: LiveFailure, detail: string): LivePlayback => ({
      kind: 'failed',
      failure,
      diagnostic: scrubSecrets(`live ${cameraId} ${quality}: ${detail}`),
    })

    const media = env.createMediaSource()
    if (!media) {
      onPlayback(failed('unsupported_browser', 'MediaSource unavailable'))
      return () => undefined
    }
    const playable = playableCodecs((mime) => env.isTypeSupported(mime))
    const codecs = playable.filter((codec) => withSound || !AUDIO_CODEC.test(codec))
    // Muted, the stream is asked without sound, so a sound the browser could play is only offered.
    const soundPlayable = playable.some((codec) => AUDIO_CODEC.test(codec))
    if (!codecs.some((codec) => VIDEO_CODEC.test(codec))) {
      onPlayback(failed('unsupported_codec', 'no H.264 nor H.265 in MSE'))
      return () => undefined
    }

    const url = liveStreamUrl(this.apiBaseUrl, cameraId, quality, env.pageUrl())
    const { source } = media
    const queue: ArrayBuffer[] = []
    let socket: WebSocket | null = null
    let buffer: SourceBuffer | null = null
    let hasAudio = false
    let playing = false
    let ended = false
    let clockStart: { wall: number; media: number } | null = null
    const firstSegment = setTimeout(
      () => fail('unreachable', `no video within ${FIRST_SEGMENT_MS / 1000} s`),
      FIRST_SEGMENT_MS,
    )

    function release() {
      ended = true
      clearTimeout(firstSegment)
      video.removeEventListener('error', onMediaError)
      if (socket) {
        socket.onclose = null
        socket.onmessage = null
        socket.close()
      }
      video.removeAttribute('src')
      video.srcObject = null
    }

    function fail(failure: LiveFailure, detail: string) {
      if (ended) return
      release()
      onPlayback(failed(failure, detail))
    }

    // A decode failure closes the source, so the cause is read from the video, not from the next append.
    function onMediaError() {
      if (ended) return
      if (withSound && retryWithoutAudio && hasAudio) {
        release()
        retryWithoutAudio()
        return
      }
      const error = video.error
      fail('unsupported_codec', `media error ${error?.code ?? '?'}: ${error?.message ?? ''}`.trim())
    }

    // A camera that pauses its sound, as the V380 does while it moves, leaves the audio timeline behind for good.
    function keepInStepWithTheClock(): boolean {
      if (!withSound) return true
      const now = env.now()
      // Measured from the first frame shown: waiting for the camera's key frame is not drift.
      if (clockStart === null) {
        if (video.currentTime > 0) clockStart = { wall: now, media: video.currentTime }
        return true
      }
      const behind = (now - clockStart.wall) / 1000 - (video.currentTime - clockStart.media)
      if (behind <= MAX_DRIFT_S) return true
      release()
      onPlayback({ kind: 'interrupted' })
      return false
    }

    function keepLive() {
      if (!buffer || video.buffered.length === 0) return
      if (!keepInStepWithTheClock()) return
      const end = video.buffered.end(video.buffered.length - 1)
      if (end - video.currentTime > MAX_LAG_S) video.currentTime = end - LIVE_EDGE_S
      const start = video.buffered.start(0)
      if (!buffer.updating && video.currentTime - start > KEPT_BUFFER_S * 2) {
        buffer.remove(start, video.currentTime - KEPT_BUFFER_S)
      }
    }

    function flush() {
      if (ended || !buffer || buffer.updating) return
      const next = queue.shift()
      if (next) {
        try {
          buffer.appendBuffer(next)
        } catch (e) {
          if (video.error) onMediaError()
          else fail('unreachable', e instanceof Error ? e.message : String(e))
        }
        return
      }
      keepLive()
    }

    function onSegmentAppended() {
      if (!playing) {
        playing = true
        clearTimeout(firstSegment)
        onPlayback({ kind: 'playing', soundOffered: withSound ? hasAudio : soundPlayable })
        // Muted autoplay is allowed everywhere; a refusal leaves the picture on its first frame.
        void video.play().catch(() => undefined)
      }
      flush()
    }

    function onAnswer(answered: string) {
      const mime = playableMime(answered, (type) => env.isTypeSupported(type))
      const tracks = tracksOf(mime)
      if (!tracks.video || !env.isTypeSupported(mime)) {
        fail('unsupported_codec', `mse ${mime}`)
        return
      }
      hasAudio = tracks.audio
      buffer = source.addSourceBuffer(mime)
      buffer.mode = 'segments'
      buffer.addEventListener('updateend', onSegmentAppended)
      flush()
    }

    function onText(text: string) {
      const message = parseMessage(text)
      switch (message?.type) {
        case 'mse':
          onAnswer(message.value)
          return
        case 'error':
          // go2rtc's only way to say the camera's codec is none the browser offered.
          fail(
            CODECS_NOT_MATCHED.test(message.value) ? 'unsupported_codec' : 'unreachable',
            message.value,
          )
          return
        default:
          return
      }
    }

    source.addEventListener(
      'sourceopen',
      () => {
        if (ended) return
        const opened = env.createSocket(url)
        socket = opened
        opened.binaryType = 'arraybuffer'
        opened.onopen = () => opened.send(JSON.stringify({ type: 'mse', value: codecs.join(',') }))
        opened.onmessage = (event: MessageEvent<string | ArrayBuffer>) => {
          if (typeof event.data === 'string') {
            onText(event.data)
            return
          }
          queue.push(event.data)
          flush()
        }
        opened.onclose = (event) => {
          if (ended) return
          const refused = event.code in CLOSE_FAILURES
          if (playing && !refused) {
            release()
            onPlayback({ kind: 'interrupted' })
            return
          }
          fail(failureOfClose(event.code), `close ${event.code} ${event.reason}`.trim())
        }
      },
      { once: true },
    )
    env.attach(video, source, media.managed)
    video.addEventListener('error', onMediaError)

    return () => {
      if (!ended) release()
    }
  }
}
