import type { CameraDraftInput } from '../entities/camera_draft_input.entity'
import type { Camera } from '../entities/camera.entity'
import type { CameraStatus } from '../entities/camera_status.entity'
import type { CameraPrivacySchedule } from '../entities/camera_privacy_schedule.entity'
import type { DiscoveredCamera } from '../entities/discovered_camera.entity'
import type { CameraConfigurationApplyResult } from '../entities/camera_configuration_apply_result.entity'
import type { VendorAssistance } from '../entities/vendor_assistance.entity'
import type {
  CameraCapabilityBinding,
  Capability,
  SupportedProtocol,
} from '../entities/camera_capability_binding.entity'
import type { PtzPreset } from '../entities/ptz_preset.entity'
import type { CameraImageSettings } from '../entities/camera_image_settings.entity'

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
  discover(input?: DiscoveryRequest): Promise<DiscoveredCamera[]>
  getVendorAssistance(input: VendorAssistanceRequest): Promise<VendorAssistance | null>
  create(input: CameraDraftInput): Promise<Camera>
  update(cameraId: string, input: CameraDraftInput): Promise<Camera>
  verifyDraft(input: CameraDraftInput): Promise<CameraStatus>
  verify(cameraId: string): Promise<CameraStatus>
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
  ptzStartMove(cameraId: string, direction: string, speed: number): Promise<void>
  /** False once the server holds no move of this camera any more. */
  ptzSignalMove(cameraId: string): Promise<boolean>
  ptzStopMove(cameraId: string): Promise<void>
  ptzGoToPreset(cameraId: string, presetId: number): Promise<void>
  getPtzPresets(cameraId: string): Promise<{
    presets: PtzPreset[]
    calibrated: boolean
    currentPosition: { x: number; y: number } | null
  }>
  ptzSaveCurrentAsPreset(cameraId: string, presetId: number): Promise<void>
  ptzCalibrate(cameraId: string): Promise<void>
  capturePtzPresetThumbnail(cameraId: string, presetId: number): Promise<void>
  // Capability bindings (ADR-22)
  getCapabilities(cameraId: string): Promise<CameraCapabilityBinding[]>
  configureCapability(
    cameraId: string,
    capability: Capability,
    protocol: SupportedProtocol,
    configJson?: string,
  ): Promise<CameraCapabilityBinding>
  probeCapability(cameraId: string, capability: Capability): Promise<CameraCapabilityBinding>
  removeCapability(cameraId: string, capability: Capability): Promise<void>
  setPtzPanInverted(cameraId: string, inverted: boolean): Promise<CameraCapabilityBinding>
  detectCapabilities(cameraId: string): Promise<void>
  // Image settings (ADR-27) — read/written live on the camera, nothing persisted by Vyzio.
  getImageSettings(cameraId: string): Promise<CameraImageSettings>
  setImageSettings(cameraId: string, settings: CameraImageSettings): Promise<CameraImageSettings>
}
