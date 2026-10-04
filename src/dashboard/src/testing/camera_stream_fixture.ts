import type {
  AvailableStream,
  CameraStream,
  CameraStreamLineup,
} from '../domain/entities/camera_stream.entity'

/** A stream line as the screens read it, for tests: the main RTSP stream, recording and detecting, checked. */
export function makeCameraStream(overrides: Partial<CameraStream> = {}): CameraStream {
  return {
    id: 'main',
    ordinal: 0,
    protocol: 'rtsp',
    path: '/stream1',
    width: 1920,
    height: 1080,
    fps: 15,
    role: 'record_and_detect',
    verified: true,
    checkedAt: '2026-01-01T00:00:00Z',
    lastError: null,
    ...overrides,
  }
}

/** A stream the camera offers, for tests: a lighter one not listed yet. */
export function makeAvailableStream(overrides: Partial<AvailableStream> = {}): AvailableStream {
  return {
    rank: 1,
    path: '/stream2',
    width: 640,
    height: 360,
    fps: 15,
    streamId: null,
    ...overrides,
  }
}

/** A lineup whose roles are given by the test, as the server resolves them. */
export function makeStreamLineup(
  streams: CameraStream[],
  overrides: Partial<Omit<CameraStreamLineup, 'streams'>> = {},
): CameraStreamLineup {
  return {
    streams,
    recordStreamId: streams[0]?.id ?? null,
    detectStreamId: streams[0]?.id ?? null,
    detectsOnRecordingStream: false,
    ...overrides,
  }
}
