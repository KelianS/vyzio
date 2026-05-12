import type { CameraApplyResult } from '../entities/CameraApplyResult'
import type { CameraDraftInput } from '../entities/CameraDraftInput'
import type { Camera } from '../entities/Camera'
import type { CameraStatus } from '../entities/CameraStatus'
import type { DiscoveredCamera } from '../entities/DiscoveredCamera'

export interface CameraRepository {
  getAll(): Promise<Camera[]>
  getStatus(cameraId: string): Promise<CameraStatus>
  discover(): Promise<DiscoveredCamera[]>
  create(input: CameraDraftInput): Promise<Camera>
  verify(cameraId: string): Promise<CameraStatus>
  apply(cameraId: string): Promise<CameraApplyResult>
}