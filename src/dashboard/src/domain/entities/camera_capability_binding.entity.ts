export type Capability = 'stream' | 'ptz' | 'hardware_privacy' | 'image_settings'
export type SupportedProtocol = 'onvif' | 'dvrip' | 'tapo_klap' | 'v380' | 'rtsp'

/** The protocols a video stream can travel over (ADR-19, ADR-61). */
export const StreamProtocol = {
  Rtsp: 'rtsp',
  Dvrip: 'dvrip',
} as const

export type StreamProtocol = (typeof StreamProtocol)[keyof typeof StreamProtocol]

export interface CameraCapabilityBinding {
  capability: Capability
  protocol: SupportedProtocol
  configJson: string | null
  verified: boolean
  verifiedAt: string | null
  lastError: string | null
  isPreset: boolean
  isConfigured: boolean
  /** Whether left and right are swapped; null for a capability that does not move (SPECS 11). */
  panInverted: boolean | null
  /** The stream's main path, its own setting; null for any other capability (ADR-61). */
  streamPath: string | null
  /** Whether the camera keeps its positions itself, else Vyzio counts them; null for any other capability (ADR-64). */
  nativePositions: boolean | null
}
