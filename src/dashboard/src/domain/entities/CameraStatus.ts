export interface CameraStatus {
  cameraId: string
  displayName: string
  status: string
  validationState: string
  connected: boolean
  previewAvailable: boolean
  needsAttention: boolean
  guidance: string | null
  lastReachabilityCheckAt: string | null
  lastSuccessfulFrameAt: string | null
  /** The camera answers on the network but refuses its account (ADR-58). */
  accountRefused: boolean
}
