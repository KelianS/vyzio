import type { Camera } from '../../domain/entities/Camera'

/** A camera as the screens read it, for tests; each test overrides only what it is about. */
export function makeCamera(overrides: Partial<Camera> = {}): Camera {
  return {
    id: 'camera-1',
    slug: 'front-door',
    displayName: 'Front Door',
    sourceType: 'rtsp_manual',
    host: '192.168.1.10',
    port: 554,
    streamProtocol: 'rtsp',
    status: 'online',
    validationState: 'validated',
    isEnabled: true,
    previewAvailable: true,
    needsAttention: false,
    lastReachabilityCheckAt: null,
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
    supportedProtocols: [],
    connected: true,
    verifiedCapabilities: [],
    ...overrides,
  }
}
