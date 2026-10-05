/** Why the camera's part of the last privacy toggle is not confirmed (SPECS 9.2); null when it followed. */
export const PrivacyMiss = {
  PositionMissing: 'position_missing',
  CapabilityUnverified: 'capability_unverified',
  CameraFailed: 'camera_failed',
  /** The request was cut before the camera answered: nobody knows what it did. */
  Unconfirmed: 'unconfirmed',
} as const

export type PrivacyMiss = (typeof PrivacyMiss)[keyof typeof PrivacyMiss]

/** How a camera stops filming when privacy mode is on (SPECS 9.3). */
export const PrivacyStrategy = {
  SoftwareBlur: 'software_blur',
  PtzParking: 'ptz_parking',
  Hardware: 'hardware',
} as const

export type PrivacyStrategy = (typeof PrivacyStrategy)[keyof typeof PrivacyStrategy]

/** A camera's own status as the backend reports it; any other value has not been checked since it changed. */
export const CameraState = {
  Online: 'online',
  Offline: 'offline',
  Degraded: 'degraded',
  ConfigError: 'config_error',
  /** Its stream never worked: the only status it has until then (ADR-68 d). */
  ToSetUp: 'to_set_up',
} as const

/** Where a camera stands towards surveillance; only a validated one is in it (ADR-23, ADR-68 d). */
export const CameraValidation = {
  ToSetUp: 'to_set_up',
  Draft: 'draft',
  Validated: 'validated',
  PendingRemoval: 'pending_removal',
} as const

/** The live view's qualities (ADR-72 c): the low one first, the high one when recording runs on another stream. */
export const LiveQuality = {
  Low: 'low',
  High: 'high',
} as const

export type LiveQuality = (typeof LiveQuality)[keyof typeof LiveQuality]

export interface Camera {
  id: string
  slug: string
  displayName: string
  sourceType: string
  host: string
  username?: string | null
  status: string
  connected: boolean
  validationState: string
  isEnabled: boolean
  previewAvailable: boolean
  needsAttention: boolean
  lastReachabilityCheckAt: string | null
  lastSuccessfulFrameAt: string | null
  frigateCameraName: string
  privacyModeActive: boolean
  privacyModeSource: 'manual' | 'schedule' | null
  privacyVendorCut: boolean
  privacyMiss: PrivacyMiss | null
  privacyMissDetail: string | null
  ptzSupported: boolean
  privacyStrategy: PrivacyStrategy
  verifiedCapabilities: string[]
  /** The qualities its live view offers; empty while it is not in surveillance. */
  liveQualities: LiveQuality[]
  /** When detection last finished; null: never, so its page runs it on arrival (ADR-68 b). */
  detectedAt: string | null
}
