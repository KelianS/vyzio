import type { CameraCapabilityBinding } from '../domain/entities/camera_capability_binding.entity'

/** A capability binding as the screens read it, for tests; each test overrides only what it is about. */
export function makeCapabilityBinding(
  overrides: Partial<CameraCapabilityBinding> = {},
): CameraCapabilityBinding {
  return {
    capability: 'image_settings',
    protocol: 'onvif',
    configJson: null,
    verified: true,
    verifiedAt: null,
    lastError: null,
    isPreset: true,
    isConfigured: true,
    panInverted: null,
    streamPath: null,
    nativePositions: null,
    ...overrides,
  }
}
