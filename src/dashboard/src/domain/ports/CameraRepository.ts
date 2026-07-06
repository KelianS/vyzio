import type { CameraApplyResult } from '../entities/CameraApplyResult'
import type { CameraDraftInput } from '../entities/CameraDraftInput'
import type { Camera } from '../entities/Camera'
import type { CameraStatus } from '../entities/CameraStatus'
import type { CameraPrivacySchedule } from '../entities/CameraPrivacySchedule'
import type { DiscoveredCamera } from '../entities/DiscoveredCamera'
import type { CameraConfigurationApplyResult } from '../entities/CameraConfigurationApplyResult'
import type { VendorAssistance } from '../entities/VendorAssistance'
import type {
  CameraCapabilityBinding,
  Capability,
  SupportedProtocol,
} from '../entities/CameraCapabilityBinding'
import type { PtzPreset } from '../entities/PtzPreset'

export interface CreatePrivacyScheduleInput {
  daysOfWeek: number[]
  startTime: string
  endTime: string
  enabled?: boolean
}

export interface UpdatePrivacyScheduleInput {
  daysOfWeek?: number[]
  startTime?: string
  endTime?: string
  enabled?: boolean
}

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
  togglePrivacyMode(cameraId: string, active: boolean): Promise<Camera>
  batchTogglePrivacyMode(cameraIds: string[], active: boolean): Promise<Camera[]>
  getPrivacySchedules(cameraId: string): Promise<CameraPrivacySchedule[]>
  createPrivacySchedule(
    cameraId: string,
    input: CreatePrivacyScheduleInput,
  ): Promise<CameraPrivacySchedule>
  updatePrivacySchedule(
    cameraId: string,
    scheduleId: string,
    input: UpdatePrivacyScheduleInput,
  ): Promise<CameraPrivacySchedule>
  deletePrivacySchedule(cameraId: string, scheduleId: string): Promise<void>
  setPrivacyStrategy(cameraId: string, strategy: string): Promise<Camera>
  ptzStep(cameraId: string, direction: string, speed: number): Promise<void>
  ptzSavePreset(cameraId: string, presetId: number): Promise<void>
  ptzGoToPreset(cameraId: string, presetId: number): Promise<void>
  ptzConfigureParking(cameraId: string): Promise<void>
  getPtzPresets(cameraId: string): Promise<PtzPreset[]>
  ptzSaveCurrentAsPreset(cameraId: string, presetId: number): Promise<void>
  // Capability bindings (ADR-22)
  getCapabilities(cameraId: string): Promise<CameraCapabilityBinding[]>
  configureCapability(
    cameraId: string,
    capability: Capability,
    protocol: SupportedProtocol,
    configJson?: string,
  ): Promise<CameraCapabilityBinding>
  probeCapability(cameraId: string, capability: Capability): Promise<CameraCapabilityBinding>
}
