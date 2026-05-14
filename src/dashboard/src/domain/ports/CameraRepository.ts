import type { CameraApplyResult } from '../entities/CameraApplyResult'
import type { CameraDraftInput } from '../entities/CameraDraftInput'
import type { Camera } from '../entities/Camera'
import type { CameraStatus } from '../entities/CameraStatus'
import type { DiscoveredCamera } from '../entities/DiscoveredCamera'
import type { CameraConfigurationApplyResult } from '../entities/CameraConfigurationApplyResult'
import type { VendorAssistance } from '../entities/VendorAssistance'

export interface VendorAssistanceRequest {
  vendorFamily: string | null
  streamPath: string | null
  connected: boolean
}

export interface DiscoveryRequest {
  host: string
  port?: number
}

export interface CameraRepository {
  getAll(): Promise<Camera[]>
  getStatus(cameraId: string): Promise<CameraStatus>
  discover(input?: DiscoveryRequest): Promise<DiscoveredCamera[]>
  getVendorAssistance(input: VendorAssistanceRequest): Promise<VendorAssistance | null>
  create(input: CameraDraftInput): Promise<Camera>
  update(cameraId: string, input: CameraDraftInput): Promise<Camera>
  verifyDraft(input: CameraDraftInput): Promise<CameraStatus>
  verify(cameraId: string): Promise<CameraStatus>
  apply(cameraId: string): Promise<CameraApplyResult>
  applyConfiguration(): Promise<CameraConfigurationApplyResult>
  delete(cameraId: string): Promise<{ deleted: boolean; message: string; configPath: string }>
}