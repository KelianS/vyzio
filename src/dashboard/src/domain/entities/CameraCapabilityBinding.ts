export type Capability = 'ptz' | 'hardware_privacy'
export type SupportedProtocol = 'onvif' | 'dvrip' | 'tapo_klap' | 'v380' | 'rtsp'

export interface CameraCapabilityBinding {
  capability: Capability
  protocol: SupportedProtocol
  configJson: string | null
  verified: boolean
  verifiedAt: string | null
  lastError: string | null
  isPreset: boolean
  isConfigured: boolean
}
