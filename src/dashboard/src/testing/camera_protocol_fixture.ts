import type { CameraProtocol } from '../domain/entities/camera_protocol.entity'

/** A protocol row as the screens read it, for tests: RTSP on its usual port, answering. */
export function makeCameraProtocol(overrides: Partial<CameraProtocol> = {}): CameraProtocol {
  return {
    protocol: 'rtsp',
    port: null,
    effectivePort: 554,
    username: null,
    hasOwnAccount: false,
    deviceId: null,
    status: 'answers',
    checkedAt: null,
    lastError: null,
    ...overrides,
  }
}
