export type Capability = 'stream' | 'ptz' | 'hardware_privacy' | 'image_settings'
export type SupportedProtocol = 'onvif' | 'dvrip' | 'tapo_klap' | 'v380' | 'rtsp'

/** The protocols a video stream can travel over (ADR-19, ADR-61). */
export const StreamProtocol = {
  Rtsp: 'rtsp',
  Dvrip: 'dvrip',
} as const

export type StreamProtocol = (typeof StreamProtocol)[keyof typeof StreamProtocol]

/** Where a capability stands after its last check or the user's answer; only verified makes it usable (ADR-66). */
export const CapabilityStatus = {
  Failed: 'failed',
  Verified: 'verified',
  ToConfirm: 'to_confirm',
  Missing: 'missing',
  RejectedByUser: 'rejected_by_user',
} as const

export type CapabilityStatus = (typeof CapabilityStatus)[keyof typeof CapabilityStatus]

/** The statuses a try applies to: never tried yet, or tried again on purpose after the user's no (ADR-66 d). */
export const ASKABLE: Record<CapabilityStatus, boolean> = {
  to_confirm: true,
  rejected_by_user: true,
  verified: false,
  missing: false,
  failed: false,
}

export interface CameraCapabilityBinding {
  capability: Capability
  protocol: SupportedProtocol
  configJson: string | null
  verified: boolean
  /** Why it is usable or not: proven, to confirm, missing, the user's no (ADR-66). */
  status: CapabilityStatus
  /** When the user confirmed it after a try; null when the camera proved it or nobody confirmed it. */
  confirmedAt: string | null
  verifiedAt: string | null
  lastError: string | null
  isConfigured: boolean
  /** Whether left and right are swapped; null for a capability that does not move (SPECS 11). */
  panInverted: boolean | null
  /** Whether the camera keeps its positions itself, else Vyzio counts them; null for any other capability (ADR-64). */
  nativePositions: boolean | null
}
