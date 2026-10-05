import type { LiveQuality } from '../entities/camera.entity'
import type { LivePlayback } from '../entities/live_playback.entity'

export interface LiveStreamPort {
  /** Plays the camera's live stream in the video, with its sound only when asked; returns what stops it. */
  open(
    video: HTMLVideoElement,
    cameraId: string,
    quality: LiveQuality,
    withSound: boolean,
    onPlayback: (playback: LivePlayback) => void,
  ): () => void
}
