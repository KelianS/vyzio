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
  /** streamPath: the first stream's path over RTSP, when the camera lists no stream (ADR-65 e). */
  configureCapability(
    cameraId: string,
    capability: Capability,
    protocol: SupportedProtocol,
    streamPath: string | null,
  ): Promise<CameraCapabilityBinding>
  probeCapability(cameraId: string, capability: Capability): Promise<CameraCapabilityBinding>
  /** A real use of a capability to confirm, started by the user; records nothing (ADR-66). */
  tryCapability(cameraId: string, capability: Capability): Promise<void>
  /** The user's answer after a try: whether the camera did what was asked. */
  confirmCapability(
    cameraId: string,
    capability: Capability,
    worked: boolean,
  ): Promise<CameraCapabilityBinding>
  removeCapability(cameraId: string, capability: Capability): Promise<void>
  setPtzPanInverted(cameraId: string, inverted: boolean): Promise<CameraCapabilityBinding>
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
