import type {
  CameraCapabilityBinding,
  SupportedProtocol,
} from '../domain/entities/camera_capability_binding.entity'

/** The image settings binding of a camera, reached through the given protocol. */
export function makeImageSettingsBinding(protocol: SupportedProtocol): CameraCapabilityBinding {
  return {
    capability: 'image_settings',
    protocol,
    configJson: null,
    verified: true,
    verifiedAt: null,
    lastError: null,
    isPreset: true,
    isConfigured: true,
    panInverted: null,
  }
}
