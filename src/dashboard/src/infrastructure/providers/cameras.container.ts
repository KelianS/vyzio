import { RestartSurveillance } from '../../domain/usecases/restart_surveillance.use_case'
import { BatchToggleCameraPrivacyMode } from '../../domain/usecases/batch_toggle_camera_privacy_mode.use_case'
import { CapturePtzPresetThumbnail } from '../../domain/usecases/capture_ptz_preset_thumbnail.use_case'
import { AddCameraProtocol } from '../../domain/usecases/add_camera_protocol.use_case'
import { CheckCameraProtocol } from '../../domain/usecases/check_camera_protocol.use_case'
import { SearchCameraProtocols } from '../../domain/usecases/search_camera_protocols.use_case'
import { RemoveCameraProtocol } from '../../domain/usecases/remove_camera_protocol.use_case'
import { GetCameraProtocols } from '../../domain/usecases/get_camera_protocols.use_case'
import { GetCameraStreams } from '../../domain/usecases/get_camera_streams.use_case'
import { AddCameraStream } from '../../domain/usecases/add_camera_stream.use_case'
import { SetCameraStreamRole } from '../../domain/usecases/set_camera_stream_role.use_case'
import { GetAvailableCameraStreams } from '../../domain/usecases/get_available_camera_streams.use_case'
import { RemoveCameraStream } from '../../domain/usecases/remove_camera_stream.use_case'
import { CheckCameraStream } from '../../domain/usecases/check_camera_stream.use_case'
import { UpdateCameraProtocol } from '../../domain/usecases/update_camera_protocol.use_case'
import { ConfigureCameraCapability } from '../../domain/usecases/configure_camera_capability.use_case'
import { CreateCamera } from '../../domain/usecases/create_camera.use_case'
import { DeleteCamera } from '../../domain/usecases/delete_camera.use_case'
import { DetectCameraCapabilities } from '../../domain/usecases/detect_camera_capabilities.use_case'
import { DiscoverCameras } from '../../domain/usecases/discover_cameras.use_case'
import { GetDiscoveryRanges } from '../../domain/usecases/get_discovery_ranges.use_case'
import { GetCameraCapabilities } from '../../domain/usecases/get_camera_capabilities.use_case'
import { GetCameraDetectionConfig } from '../../domain/usecases/get_camera_detection_config.use_case'
import { GetCameraImageSettings } from '../../domain/usecases/get_camera_image_settings.use_case'
import { GetCameras } from '../../domain/usecases/get_cameras.use_case'
import { GetDetectionLabels } from '../../domain/usecases/get_detection_labels.use_case'
import { GetRecordingSettings } from '../../domain/usecases/get_recording_settings.use_case'
import { SaveRecordingSettings } from '../../domain/usecases/save_recording_settings.use_case'
import { GetPtzPresets } from '../../domain/usecases/get_ptz_presets.use_case'
import { GetVendorAssistance } from '../../domain/usecases/get_vendor_assistance.use_case'
import { ProbeCameraCapability } from '../../domain/usecases/probe_camera_capability.use_case'
import { TryCameraCapability } from '../../domain/usecases/try_camera_capability.use_case'
import { ConfirmCameraCapability } from '../../domain/usecases/confirm_camera_capability.use_case'
import { PtzCalibrate } from '../../domain/usecases/ptz_calibrate.use_case'
import { PtzGoToPreset } from '../../domain/usecases/ptz_go_to_preset.use_case'
import { PtzSaveCurrentAsPreset } from '../../domain/usecases/ptz_save_current_as_preset.use_case'
import { PtzStartMove } from '../../domain/usecases/ptz_start_move.use_case'
import { PtzSignalMove } from '../../domain/usecases/ptz_signal_move.use_case'
import { PtzStopMove } from '../../domain/usecases/ptz_stop_move.use_case'
import { RemoveCameraCapability } from '../../domain/usecases/remove_camera_capability.use_case'
import { SetPtzPanInverted } from '../../domain/usecases/set_ptz_pan_inverted.use_case'
import { SaveCameraDetectionConfig } from '../../domain/usecases/save_camera_detection_config.use_case'
import { SetCameraImageSettings } from '../../domain/usecases/set_camera_image_settings.use_case'
import { SetPrivacyStrategy } from '../../domain/usecases/set_privacy_strategy.use_case'
import { ToggleCameraPrivacyMode } from '../../domain/usecases/toggle_camera_privacy_mode.use_case'
import { UpdateCamera } from '../../domain/usecases/update_camera.use_case'
import { VerifyCamera } from '../../domain/usecases/verify_camera.use_case'
import type { CameraRepository } from '../../domain/ports/camera.port'
import type { ProfileRepository } from '../../domain/ports/profile.port'
import type { DetectionLabelsRepository } from '../../domain/usecases/get_detection_labels.use_case'
import type { RecordingSettingsRepository } from '../../domain/ports/recording_settings.port'
import type { CameraStreamRepository } from '../../domain/ports/camera_stream.port'

export interface CamerasContainer {
  getCameras: GetCameras
  discoverCameras: DiscoverCameras
  getDiscoveryRanges: GetDiscoveryRanges
  getVendorAssistance: GetVendorAssistance
  createCamera: CreateCamera
  updateCamera: UpdateCamera
  verifyCamera: VerifyCamera
  restartSurveillance: RestartSurveillance
  deleteCamera: DeleteCamera
  toggleCameraPrivacyMode: ToggleCameraPrivacyMode
  batchToggleCameraPrivacyMode: BatchToggleCameraPrivacyMode
  setPrivacyStrategy: SetPrivacyStrategy
  getCameraCapabilities: GetCameraCapabilities
  configureCameraCapability: ConfigureCameraCapability
  probeCameraCapability: ProbeCameraCapability
  tryCameraCapability: TryCameraCapability
  confirmCameraCapability: ConfirmCameraCapability
  removeCameraCapability: RemoveCameraCapability
  setPtzPanInverted: SetPtzPanInverted
  getCameraStreams: GetCameraStreams
  addCameraStream: AddCameraStream
  setCameraStreamRole: SetCameraStreamRole
  getAvailableCameraStreams: GetAvailableCameraStreams
  removeCameraStream: RemoveCameraStream
  checkCameraStream: CheckCameraStream
  detectCameraCapabilities: DetectCameraCapabilities
  getCameraProtocols: GetCameraProtocols
  updateCameraProtocol: UpdateCameraProtocol
  checkCameraProtocol: CheckCameraProtocol
  searchCameraProtocols: SearchCameraProtocols
  addCameraProtocol: AddCameraProtocol
  removeCameraProtocol: RemoveCameraProtocol
  getCameraImageSettings: GetCameraImageSettings
  setCameraImageSettings: SetCameraImageSettings
  getCameraDetectionConfig: GetCameraDetectionConfig
  saveCameraDetectionConfig: SaveCameraDetectionConfig
  getCameraLabels: GetDetectionLabels
  getRecordingSettings: GetRecordingSettings
  saveRecordingSettings: SaveRecordingSettings
  ptzStartMove: PtzStartMove
  ptzSignalMove: PtzSignalMove
  ptzStopMove: PtzStopMove
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
  cameraStreamRepository: CameraStreamRepository,
): CamerasContainer {
  return {
    getCameras: new GetCameras(cameraRepository),
    discoverCameras: new DiscoverCameras(cameraRepository),
    getDiscoveryRanges: new GetDiscoveryRanges(cameraRepository),
    getVendorAssistance: new GetVendorAssistance(cameraRepository),
    createCamera: new CreateCamera(cameraRepository),
    updateCamera: new UpdateCamera(cameraRepository),
    verifyCamera: new VerifyCamera(cameraRepository),
    restartSurveillance: new RestartSurveillance(cameraRepository),
    deleteCamera: new DeleteCamera(cameraRepository),
    toggleCameraPrivacyMode: new ToggleCameraPrivacyMode(cameraRepository),
    batchToggleCameraPrivacyMode: new BatchToggleCameraPrivacyMode(cameraRepository),
    setPrivacyStrategy: new SetPrivacyStrategy(cameraRepository),
    getCameraCapabilities: new GetCameraCapabilities(cameraRepository),
    configureCameraCapability: new ConfigureCameraCapability(cameraRepository),
    probeCameraCapability: new ProbeCameraCapability(cameraRepository),
    tryCameraCapability: new TryCameraCapability(cameraRepository),
    confirmCameraCapability: new ConfirmCameraCapability(cameraRepository),
    removeCameraCapability: new RemoveCameraCapability(cameraRepository),
    setPtzPanInverted: new SetPtzPanInverted(cameraRepository),
    getCameraStreams: new GetCameraStreams(cameraStreamRepository),
    addCameraStream: new AddCameraStream(cameraStreamRepository),
    setCameraStreamRole: new SetCameraStreamRole(cameraStreamRepository),
    getAvailableCameraStreams: new GetAvailableCameraStreams(cameraStreamRepository),
    removeCameraStream: new RemoveCameraStream(cameraStreamRepository),
    checkCameraStream: new CheckCameraStream(cameraStreamRepository),
    detectCameraCapabilities: new DetectCameraCapabilities(cameraRepository),
    getCameraProtocols: new GetCameraProtocols(cameraRepository),
    updateCameraProtocol: new UpdateCameraProtocol(cameraRepository),
    checkCameraProtocol: new CheckCameraProtocol(cameraRepository),
    searchCameraProtocols: new SearchCameraProtocols(cameraRepository),
    addCameraProtocol: new AddCameraProtocol(cameraRepository),
    removeCameraProtocol: new RemoveCameraProtocol(cameraRepository),
    getCameraImageSettings: new GetCameraImageSettings(cameraRepository),
    setCameraImageSettings: new SetCameraImageSettings(cameraRepository),
    getCameraDetectionConfig: new GetCameraDetectionConfig(profileRepository),
    saveCameraDetectionConfig: new SaveCameraDetectionConfig(profileRepository),
    getCameraLabels: new GetDetectionLabels(cameraLabelsRepository),
    getRecordingSettings: new GetRecordingSettings(recordingSettingsRepository),
    saveRecordingSettings: new SaveRecordingSettings(recordingSettingsRepository),
    ptzStartMove: new PtzStartMove(cameraRepository),
    ptzSignalMove: new PtzSignalMove(cameraRepository),
    ptzStopMove: new PtzStopMove(cameraRepository),
    ptzGoToPreset: new PtzGoToPreset(cameraRepository),
    getPtzPresets: new GetPtzPresets(cameraRepository),
    ptzSaveCurrentAsPreset: new PtzSaveCurrentAsPreset(cameraRepository),
    ptzCalibrate: new PtzCalibrate(cameraRepository),
    capturePtzPresetThumbnail: new CapturePtzPresetThumbnail(cameraRepository),
  }
}
