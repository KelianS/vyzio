import type { Camera } from '../domain/entities/camera.entity'

/** A camera as the screens read it, for tests; each test overrides only what it is about. */
export function makeCamera(overrides: Partial<Camera> = {}): Camera {
  return {
    id: 'camera-1',
    slug: 'front-door',
    displayName: 'Front Door',
    sourceType: 'rtsp_manual',
    host: '192.168.1.10',
    status: 'online',
    validationState: 'validated',
    isEnabled: true,
    previewAvailable: true,
    needsAttention: false,
    // Checked once: a camera that answers has been asked.
    lastReachabilityCheckAt: '2026-07-05T08:00:00Z',
    lastSuccessfulFrameAt: null,
    frigateCameraName: 'front_door',
    vendorFamily: null,
    privacyModeActive: false,
    privacyModeSource: null,
    privacyVendorCut: false,
    privacyMiss: null,
    privacyMissDetail: null,
    ptzSupported: false,
    privacyStrategy: 'software_blur',
    connected: true,
    verifiedCapabilities: [],
    // Detected once: only a camera just added has its page run detection on arrival (ADR-68 b).
    detectedAt: '2026-07-05T08:00:00Z',
    ...overrides,
  }
}
