import type { LiveQuality } from '../entities/camera.entity'
import type { LivePlayback } from '../entities/live_playback.entity'

export interface LiveStreamPort {
  /** Plays the camera's live stream in the video, reporting where it stands; returns what stops it. */
  open(
    video: HTMLVideoElement,
    cameraId: string,
    quality: LiveQuality,
    onPlayback: (playback: LivePlayback) => void,
  ): () => void
}
