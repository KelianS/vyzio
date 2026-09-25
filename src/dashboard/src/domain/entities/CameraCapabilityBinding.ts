export type Capability = 'ptz' | 'hardware_privacy' | 'image_settings'
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
  /** Whether left and right are swapped; null for a capability that does not move (SPECS 9.3). */
  panInverted: boolean | null
}
