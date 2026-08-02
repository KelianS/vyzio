import { ApplyCamera } from '../../domain/usecases/ApplyCamera'
import { ApplyCameraConfiguration } from '../../domain/usecases/ApplyCameraConfiguration'
import { BatchToggleCameraPrivacyMode } from '../../domain/usecases/BatchToggleCameraPrivacyMode'
import { CapturePtzPresetThumbnail } from '../../domain/usecases/CapturePtzPresetThumbnail'
import { ConfigureCameraCapability } from '../../domain/usecases/ConfigureCameraCapability'
import { CreateCamera } from '../../domain/usecases/CreateCamera'
import { CreateCameraPrivacySchedule } from '../../domain/usecases/CreateCameraPrivacySchedule'
import { DeleteCamera } from '../../domain/usecases/DeleteCamera'
import { DeleteCameraPrivacySchedule } from '../../domain/usecases/DeleteCameraPrivacySchedule'
import { DetectCameraCapabilities } from '../../domain/usecases/DetectCameraCapabilities'
import { DiscoverCameras } from '../../domain/usecases/DiscoverCameras'
import { GetCameraCapabilities } from '../../domain/usecases/GetCameraCapabilities'
import { GetCameraDetectionConfig } from '../../domain/usecases/GetCameraDetectionConfig'
import { GetCameraImageSettings } from '../../domain/usecases/GetCameraImageSettings'
import { GetCameraPrivacySchedules } from '../../domain/usecases/GetCameraPrivacySchedules'
import { GetCameraStatus } from '../../domain/usecases/GetCameraStatus'
import { GetCameras } from '../../domain/usecases/GetCameras'
import { GetDetectionLabels } from '../../domain/usecases/GetDetectionLabels'
import { GetRecordingSettings } from '../../domain/usecases/GetRecordingSettings'
import { SaveRecordingSettings } from '../../domain/usecases/SaveRecordingSettings'
import { GetPtzPresets } from '../../domain/usecases/GetPtzPresets'
import { GetVendorAssistance } from '../../domain/usecases/GetVendorAssistance'
import { ProbeCameraCapability } from '../../domain/usecases/ProbeCameraCapability'
import { PtzCalibrate } from '../../domain/usecases/PtzCalibrate'
import { PtzGoToPreset } from '../../domain/usecases/PtzGoToPreset'
import { PtzSaveCurrentAsPreset } from '../../domain/usecases/PtzSaveCurrentAsPreset'
import { PtzStep } from '../../domain/usecases/PtzStep'
import { RemoveCameraCapability } from '../../domain/usecases/RemoveCameraCapability'
import { SaveCameraDetectionConfig } from '../../domain/usecases/SaveCameraDetectionConfig'
import { SetCameraImageSettings } from '../../domain/usecases/SetCameraImageSettings'
import { SetPrivacyStrategy } from '../../domain/usecases/SetPrivacyStrategy'
import { ToggleCameraPrivacyMode } from '../../domain/usecases/ToggleCameraPrivacyMode'
import { UpdateCamera } from '../../domain/usecases/UpdateCamera'
import { VerifyCamera } from '../../domain/usecases/VerifyCamera'
import { VerifyDraftCamera } from '../../domain/usecases/VerifyDraftCamera'
import type { CameraRepository } from '../../domain/ports/CameraRepository'
import type { ProfileRepository } from '../../domain/ports/ProfileRepository'
import type { DetectionLabelsRepository } from '../../domain/usecases/GetDetectionLabels'
import type { RecordingSettingsRepository } from '../../domain/ports/RecordingSettingsRepository'

export interface CamerasContainer {
  getCameras: GetCameras
  getCameraStatus: GetCameraStatus
  discoverCameras: DiscoverCameras
  getVendorAssistance: GetVendorAssistance
  createCamera: CreateCamera
  updateCamera: UpdateCamera
  verifyDraftCamera: VerifyDraftCamera
  verifyCamera: VerifyCamera
  applyCamera: ApplyCamera
  applyCameraConfiguration: ApplyCameraConfiguration
  deleteCamera: DeleteCamera
  toggleCameraPrivacyMode: ToggleCameraPrivacyMode
  batchToggleCameraPrivacyMode: BatchToggleCameraPrivacyMode
  getCameraPrivacySchedules: GetCameraPrivacySchedules
  createCameraPrivacySchedule: CreateCameraPrivacySchedule
  deleteCameraPrivacySchedule: DeleteCameraPrivacySchedule
  setPrivacyStrategy: SetPrivacyStrategy
  getCameraCapabilities: GetCameraCapabilities
  configureCameraCapability: ConfigureCameraCapability
  probeCameraCapability: ProbeCameraCapability
  removeCameraCapability: RemoveCameraCapability
  detectCameraCapabilities: DetectCameraCapabilities
  getCameraImageSettings: GetCameraImageSettings
  setCameraImageSettings: SetCameraImageSettings
  getCameraDetectionConfig: GetCameraDetectionConfig
  saveCameraDetectionConfig: SaveCameraDetectionConfig
  getCameraLabels: GetDetectionLabels
  getRecordingSettings: GetRecordingSettings
  saveRecordingSettings: SaveRecordingSettings
  ptzStep: PtzStep
  ptzGoToPreset: PtzGoToPreset
  getPtzPresets: GetPtzPresets
  ptzSaveCurrentAsPreset: PtzSaveCurrentAsPreset
  ptzCalibrate: PtzCalibrate
  capturePtzPresetThumbnail: CapturePtzPresetThumbnail
}

export function makeCamerasContainer(
  cameraRepository: CameraRepository,
  profileRepository: ProfileRepository,
  cameraLabelsRepository: DetectionLabelsRepository,
  recordingSettingsRepository: RecordingSettingsRepository,
): CamerasContainer {
  return {
    getCameras: new GetCameras(cameraRepository),
    getCameraStatus: new GetCameraStatus(cameraRepository),
    discoverCameras: new DiscoverCameras(cameraRepository),
    getVendorAssistance: new GetVendorAssistance(cameraRepository),
    createCamera: new CreateCamera(cameraRepository),
    updateCamera: new UpdateCamera(cameraRepository),
    verifyDraftCamera: new VerifyDraftCamera(cameraRepository),
    verifyCamera: new VerifyCamera(cameraRepository),
    applyCamera: new ApplyCamera(cameraRepository),
    applyCameraConfiguration: new ApplyCameraConfiguration(cameraRepository),
    deleteCamera: new DeleteCamera(cameraRepository),
    toggleCameraPrivacyMode: new ToggleCameraPrivacyMode(cameraRepository),
    batchToggleCameraPrivacyMode: new BatchToggleCameraPrivacyMode(cameraRepository),
    getCameraPrivacySchedules: new GetCameraPrivacySchedules(cameraRepository),
    createCameraPrivacySchedule: new CreateCameraPrivacySchedule(cameraRepository),
    deleteCameraPrivacySchedule: new DeleteCameraPrivacySchedule(cameraRepository),
    setPrivacyStrategy: new SetPrivacyStrategy(cameraRepository),
    getCameraCapabilities: new GetCameraCapabilities(cameraRepository),
    configureCameraCapability: new ConfigureCameraCapability(cameraRepository),
    probeCameraCapability: new ProbeCameraCapability(cameraRepository),
    removeCameraCapability: new RemoveCameraCapability(cameraRepository),
    detectCameraCapabilities: new DetectCameraCapabilities(cameraRepository),
    getCameraImageSettings: new GetCameraImageSettings(cameraRepository),
    setCameraImageSettings: new SetCameraImageSettings(cameraRepository),
    getCameraDetectionConfig: new GetCameraDetectionConfig(profileRepository),
    saveCameraDetectionConfig: new SaveCameraDetectionConfig(profileRepository),
    getCameraLabels: new GetDetectionLabels(cameraLabelsRepository),
    getRecordingSettings: new GetRecordingSettings(recordingSettingsRepository),
    saveRecordingSettings: new SaveRecordingSettings(recordingSettingsRepository),
    ptzStep: new PtzStep(cameraRepository),
    ptzGoToPreset: new PtzGoToPreset(cameraRepository),
    getPtzPresets: new GetPtzPresets(cameraRepository),
    ptzSaveCurrentAsPreset: new PtzSaveCurrentAsPreset(cameraRepository),
    ptzCalibrate: new PtzCalibrate(cameraRepository),
    capturePtzPresetThumbnail: new CapturePtzPresetThumbnail(cameraRepository),
  }
}
