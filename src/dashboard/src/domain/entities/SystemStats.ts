export type FrigateStatus = 'active' | 'restarting' | 'unavailable'

export interface SystemStats {
  status: FrigateStatus
  storage: StorageStats | null
  cameras: CameraFps[]
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
