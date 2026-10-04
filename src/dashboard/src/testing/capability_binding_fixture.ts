import {
  CapabilityStatus,
  type CameraCapabilityBinding,
} from '../domain/entities/camera_capability_binding.entity'

/** A capability binding as the screens read it, for tests; each test overrides only what it is about, its status following verified. */
export function makeCapabilityBinding(
  overrides: Partial<CameraCapabilityBinding> = {},
): CameraCapabilityBinding {
  const verified = overrides.verified ?? true
  return {
    capability: 'image_settings',
    protocol: 'onvif',
    configJson: null,
    verified,
    status: verified ? CapabilityStatus.Verified : CapabilityStatus.Failed,
    confirmedAt: null,
    verifiedAt: null,
    lastError: null,
    isPreset: true,
    isConfigured: true,
    panInverted: null,
    nativePositions: null,
    ...overrides,
  }
}
