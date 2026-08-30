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

export interface DetectionConfig {
  hardware: FrigateDetectorKind
  targetFps: number
}

export interface StorageStats {
  totalGb: number
  usedGb: number
  freeGb: number
}

export interface CameraFps {
  camera: string
  fps: number
}
