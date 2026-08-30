export type FrigateStatus = 'active' | 'restarting' | 'unavailable'

export type FrigateDetectorKind = 'edge_tpu' | 'openvino' | 'cpu'

export interface SystemStats {
  status: FrigateStatus
  storage: StorageStats | null
  cameras: CameraFps[]
  detection: DetectionConfig
  // Saved settings that surveillance has not picked up yet (ADR-44).
  pendingChanges: boolean
}

interface DetectionConfig {
  hardware: FrigateDetectorKind
  targetFps: number
}

interface StorageStats {
  totalGb: number
  usedGb: number
  freeGb: number
}

interface CameraFps {
  camera: string
  fps: number
}
