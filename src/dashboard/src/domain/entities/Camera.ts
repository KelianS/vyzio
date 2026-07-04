export interface Camera {
  id: string
  slug: string
  displayName: string
  sourceType: string
  host: string
  port: number
  username?: string | null
  streamPath?: string | null
  streamProtocol: string
  status: string
  validationState: string
  isEnabled: boolean
  previewAvailable: boolean
  needsAttention: boolean
  lastReachabilityCheckAt: string | null
  lastSuccessfulFrameAt: string | null
  frigateCameraName: string | null
  vendorFamily: string | null
  privacyModeActive: boolean
  privacyModeSource: 'manual' | 'schedule' | null
  privacyVendorCut: boolean
  ptzSupported: boolean
  privacyModeStrategy: 'software' | 'ptz_parking' | 'hardware'
  verifiedCapabilities: string[]
}
