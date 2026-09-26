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
}
