export type FrigateStatus = 'active' | 'restarting' | 'unavailable'

/**
 * Ce qu'un enregistrement a touche et que la surveillance n'a pas encore repris
 * (ADR-44). Le redemarrage etant decide par l'utilisateur, l'attente doit dire
 * **quoi** : « des modifications en attente » est l'etat opaque que le principe
 * produit #4 proscrit.
 */
export type SurveillanceChangeScope = 'cameras' | 'detection' | 'retention'

export type FrigateDetectorKind = 'edge_tpu' | 'openvino' | 'cpu'

export interface SystemStats {
  status: FrigateStatus
  storage: StorageStats | null
  cameras: CameraFps[]
  detection: DetectionConfig
  pendingChanges: SurveillanceChangeScope[]
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
