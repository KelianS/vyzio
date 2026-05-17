export interface SystemStats {
  available: boolean
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
