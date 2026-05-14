import type { CameraStatus } from './CameraStatus'

export interface CameraApplyResult {
  applied: boolean
  message: string
  configPath: string
  camera: CameraStatus
}