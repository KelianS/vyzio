import type { CameraDraftInput, CameraUpdateInput } from '../entities/camera_draft_input.entity'
import type {
  CameraProtocol,
  CameraProtocolAddition,
  CameraProtocolInput,
} from '../entities/camera_protocol.entity'
import type { Camera } from '../entities/camera.entity'
import type { CameraStatus } from '../entities/camera_status.entity'
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
  update(cameraId: string, input: CameraUpdateInput): Promise<Camera>
  verifyDraft(input: CameraDraftInput): Promise<CameraStatus>
  verify(cameraId: string): Promise<CameraStatus>
  applyConfiguration(): Promise<CameraConfigurationApplyResult>
  delete(cameraId: string): Promise<{ deleted: boolean; message: string; configPath: string }>
  togglePrivacyMode(cameraId: string, active: boolean): Promise<Camera>
  batchTogglePrivacyMode(cameraIds: string[], active: boolean): Promise<Camera[]>
  setPrivacyStrategy(cameraId: string, strategy: string): Promise<Camera>
  ptzStep(cameraId: string, direction: string, speed: number): Promise<void>
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
  ): Promise<CameraCapabilityBinding>
  probeCapability(cameraId: string, capability: Capability): Promise<CameraCapabilityBinding>
  removeCapability(cameraId: string, capability: Capability): Promise<void>
  setPtzPanInverted(cameraId: string, inverted: boolean): Promise<CameraCapabilityBinding>
  setStreamPath(cameraId: string, path: string | null): Promise<CameraCapabilityBinding>
  detectCapabilities(cameraId: string): Promise<void>
  // Protocols (ADR-61): how each one is reached, and whether it answers.
  getProtocols(cameraId: string): Promise<CameraProtocol[]>
  updateProtocol(
    cameraId: string,
    protocol: SupportedProtocol,
    input: CameraProtocolInput,
  ): Promise<CameraProtocol>
  checkProtocol(cameraId: string, protocol: SupportedProtocol): Promise<CameraProtocol>
  searchProtocols(cameraId: string): Promise<CameraProtocol[]>
  addProtocol(cameraId: string, addition: CameraProtocolAddition): Promise<CameraProtocol>
  removeProtocol(cameraId: string, protocol: SupportedProtocol): Promise<void>
  // Image settings (ADR-27) — read/written live on the camera, nothing persisted by Vyzio.
  getImageSettings(cameraId: string): Promise<CameraImageSettings>
  setImageSettings(cameraId: string, settings: CameraImageSettings): Promise<CameraImageSettings>
}
