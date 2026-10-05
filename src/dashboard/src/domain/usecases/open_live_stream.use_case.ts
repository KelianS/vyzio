import type { LiveQuality } from '../entities/camera.entity'
import type { LivePlayback } from '../entities/live_playback.entity'
import type { LiveStreamPort } from '../ports/live_stream.port'

export class OpenLiveStream {
  constructor(private readonly stream: LiveStreamPort) {}

  execute(
    video: HTMLVideoElement,
    cameraId: string,
    quality: LiveQuality,
    onPlayback: (playback: LivePlayback) => void,
  ): () => void {
    return this.stream.open(video, cameraId, quality, onPlayback)
  }
}
