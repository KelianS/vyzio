export type Capability = 'ptz' | 'privacy_mode'
export type CapabilityProtocol =
  | 'onvif'
  | 'dvrip'
  | 'tapo_klap'
  | 'v380'
  | 'ptz_parking'
  | 'software_only'
  | 'none'

export interface CameraCapabilityBinding {
  capability: Capability
  protocol: CapabilityProtocol
  configJson: string | null
  verified: boolean
  verifiedAt: string | null
  lastError: string | null
  isPreset: boolean
  isConfigured: boolean
}
