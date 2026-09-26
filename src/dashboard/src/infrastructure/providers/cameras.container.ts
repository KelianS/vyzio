import { RestartSurveillance } from '../../domain/usecases/restart_surveillance.use_case'
import { BatchToggleCameraPrivacyMode } from '../../domain/usecases/batch_toggle_camera_privacy_mode.use_case'
import { CapturePtzPresetThumbnail } from '../../domain/usecases/capture_ptz_preset_thumbnail.use_case'
import { ConfigureCameraCapability } from '../../domain/usecases/configure_camera_capability.use_case'
import { CreateCamera } from '../../domain/usecases/create_camera.use_case'
import { CreateCameraPrivacySchedule } from '../../domain/usecases/create_camera_privacy_schedule.use_case'
import { DeleteCamera } from '../../domain/usecases/delete_camera.use_case'
import { DeleteCameraPrivacySchedule } from '../../domain/usecases/delete_camera_privacy_schedule.use_case'
import { DetectCameraCapabilities } from '../../domain/usecases/detect_camera_capabilities.use_case'
import { DiscoverCameras } from '../../domain/usecases/discover_cameras.use_case'
import { GetCameraCapabilities } from '../../domain/usecases/get_camera_capabilities.use_case'
import { GetCameraDetectionConfig } from '../../domain/usecases/get_camera_detection_config.use_case'
import { GetCameraImageSettings } from '../../domain/usecases/get_camera_image_settings.use_case'
import { GetCameraPrivacySchedules } from '../../domain/usecases/get_camera_privacy_schedules.use_case'
import { GetCameras } from '../../domain/usecases/get_cameras.use_case'
import { GetDetectionLabels } from '../../domain/usecases/get_detection_labels.use_case'
import { GetRecordingSettings } from '../../domain/usecases/get_recording_settings.use_case'
import { SaveRecordingSettings } from '../../domain/usecases/save_recording_settings.use_case'
import { GetPtzPresets } from '../../domain/usecases/get_ptz_presets.use_case'
import { GetVendorAssistance } from '../../domain/usecases/get_vendor_assistance.use_case'
import { ProbeCameraCapability } from '../../domain/usecases/probe_camera_capability.use_case'
import { PtzCalibrate } from '../../domain/usecases/ptz_calibrate.use_case'
import { PtzGoToPreset } from '../../domain/usecases/ptz_go_to_preset.use_case'
import { PtzSaveCurrentAsPreset } from '../../domain/usecases/ptz_save_current_as_preset.use_case'
import { PtzStep } from '../../domain/usecases/ptz_step.use_case'
import { RemoveCameraCapability } from '../../domain/usecases/remove_camera_capability.use_case'
import { SetPtzPanInverted } from '../../domain/usecases/set_ptz_pan_inverted.use_case'
import { SaveCameraDetectionConfig } from '../../domain/usecases/save_camera_detection_config.use_case'
import { SetCameraImageSettings } from '../../domain/usecases/set_camera_image_settings.use_case'
import { SetPrivacyStrategy } from '../../domain/usecases/set_privacy_strategy.use_case'
import { ToggleCameraPrivacyMode } from '../../domain/usecases/toggle_camera_privacy_mode.use_case'
import { UpdateCamera } from '../../domain/usecases/update_camera.use_case'
import { VerifyCamera } from '../../domain/usecases/verify_camera.use_case'
import { VerifyDraftCamera } from '../../domain/usecases/verify_draft_camera.use_case'
import type { CameraRepository } from '../../domain/ports/camera.port'
import type { ProfileRepository } from '../../domain/ports/profile.port'
import type { DetectionLabelsRepository } from '../../domain/usecases/get_detection_labels.use_case'
import type { RecordingSettingsRepository } from '../../domain/ports/recording_settings.port'

export interface CamerasContainer {
  getCameras: GetCameras
  discoverCameras: DiscoverCameras
  getVendorAssistance: GetVendorAssistance
  createCamera: CreateCamera
  updateCamera: UpdateCamera
  verifyDraftCamera: VerifyDraftCamera
  verifyCamera: VerifyCamera
  restartSurveillance: RestartSurveillance
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
  setPtzPanInverted: SetPtzPanInverted
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
    discoverCameras: new DiscoverCameras(cameraRepository),
    getVendorAssistance: new GetVendorAssistance(cameraRepository),
    createCamera: new CreateCamera(cameraRepository),
    updateCamera: new UpdateCamera(cameraRepository),
    verifyDraftCamera: new VerifyDraftCamera(cameraRepository),
    verifyCamera: new VerifyCamera(cameraRepository),
    restartSurveillance: new RestartSurveillance(cameraRepository),
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
    setPtzPanInverted: new SetPtzPanInverted(cameraRepository),
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
