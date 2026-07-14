import { AddProfilePhoto } from '../application/use-cases/AddProfilePhoto'
import { ApplyCamera } from '../application/use-cases/ApplyCamera'
import { ApplyCameraConfiguration } from '../application/use-cases/ApplyCameraConfiguration'
import { CorrectDetectionIdentity } from '../application/use-cases/CorrectDetectionIdentity'
import { CreateCamera } from '../application/use-cases/CreateCamera'
import { CreateProfile } from '../application/use-cases/CreateProfile'
import { DeleteCamera } from '../application/use-cases/DeleteCamera'
import { DeleteNotificationChannel } from '../application/use-cases/DeleteNotificationChannel'
import { DeleteProfile } from '../application/use-cases/DeleteProfile'
import { DiscoverCameras } from '../application/use-cases/DiscoverCameras'
import { GetCameraDetectionConfig } from '../application/use-cases/GetCameraDetectionConfig'
import { GetCameraStatus } from '../application/use-cases/GetCameraStatus'
import { GetCameras } from '../application/use-cases/GetCameras'
import { GetDetectionHistory } from '../application/use-cases/GetDetectionHistory'
import { GetDetectionLabels } from '../application/use-cases/GetDetectionLabels'
import { GetHubOverview } from '../application/use-cases/GetHubOverview'
import { GetSystemStats } from '../application/use-cases/GetSystemStats'
import { GetNotificationLog } from '../application/use-cases/GetNotificationLog'
import { GetNotificationChannelConfig } from '../application/use-cases/GetNotificationChannelConfig'
import { GetProfileCameraLinks } from '../application/use-cases/GetProfileCameraLinks'
import { GetProfilePhotos } from '../application/use-cases/GetProfilePhotos'
import { GetProfiles } from '../application/use-cases/GetProfiles'
import { GetVendorAssistance } from '../application/use-cases/GetVendorAssistance'
import { RemoveProfilePhoto } from '../application/use-cases/RemoveProfilePhoto'
import { ResyncFaceLibrary } from '../application/use-cases/ResyncFaceLibrary'
import { SaveCameraDetectionConfig } from '../application/use-cases/SaveCameraDetectionConfig'
import { SaveNotificationChannelConfig } from '../application/use-cases/SaveNotificationChannelConfig'
import { SetProfileCameraLinks } from '../application/use-cases/SetProfileCameraLinks'
import { TestNotificationChannel } from '../application/use-cases/TestNotificationChannel'
import { UpdateCamera } from '../application/use-cases/UpdateCamera'
import { UpdateProfile } from '../application/use-cases/UpdateProfile'
import { VerifyDraftCamera } from '../application/use-cases/VerifyDraftCamera'
import { VerifyCamera } from '../application/use-cases/VerifyCamera'
import { ToggleCameraPrivacyMode } from '../application/use-cases/ToggleCameraPrivacyMode'
import { BatchToggleCameraPrivacyMode } from '../application/use-cases/BatchToggleCameraPrivacyMode'
import { GetCameraPrivacySchedules } from '../application/use-cases/GetCameraPrivacySchedules'
import { CreateCameraPrivacySchedule } from '../application/use-cases/CreateCameraPrivacySchedule'
import { UpdateCameraPrivacySchedule } from '../application/use-cases/UpdateCameraPrivacySchedule'
import { DeleteCameraPrivacySchedule } from '../application/use-cases/DeleteCameraPrivacySchedule'
import { SetPrivacyStrategy } from '../application/use-cases/SetPrivacyStrategy'
import { PtzStep } from '../application/use-cases/PtzStep'
import { PtzSavePreset } from '../application/use-cases/PtzSavePreset'
import { PtzGoToPreset } from '../application/use-cases/PtzGoToPreset'
import { ConfigurePtzParking } from '../application/use-cases/ConfigurePtzParking'
import { GetPtzPresets } from '../application/use-cases/GetPtzPresets'
import { PtzSaveCurrentAsPreset } from '../application/use-cases/PtzSaveCurrentAsPreset'
import { PtzCalibrate } from '../application/use-cases/PtzCalibrate'
import { CapturePtzPresetThumbnail } from '../application/use-cases/CapturePtzPresetThumbnail'
import { GetCameraCapabilities } from '../application/use-cases/GetCameraCapabilities'
import { ConfigureCameraCapability } from '../application/use-cases/ConfigureCameraCapability'
import { ProbeCameraCapability } from '../application/use-cases/ProbeCameraCapability'
import { DetectCameraCapabilities } from '../application/use-cases/DetectCameraCapabilities'
import { getDashboardRuntime } from '../infrastructure/config/runtime'
import { HttpCameraRepository } from '../infrastructure/repositories/HttpCameraRepository'
import {
  HttpCameraLabelsRepository,
  HttpNotificationLabelsRepository,
} from '../infrastructure/repositories/HttpDetectionLabelsRepository'
import { HttpHubRepository } from '../infrastructure/repositories/HttpHubRepository'
import { HttpNotificationSettingsRepository } from '../infrastructure/repositories/HttpNotificationSettingsRepository'
import { HttpProfileRepository } from '../infrastructure/repositories/HttpProfileRepository'
import { HttpSystemRepository } from '../infrastructure/repositories/HttpSystemRepository'

const runtime = getDashboardRuntime()
const hubRepository = new HttpHubRepository(runtime.apiBaseUrl)
const systemRepository = new HttpSystemRepository(runtime.apiBaseUrl)
const cameraRepository = new HttpCameraRepository(runtime.apiBaseUrl)
const notificationSettingsRepository = new HttpNotificationSettingsRepository(runtime.apiBaseUrl)
const profileRepository = new HttpProfileRepository(runtime.apiBaseUrl)
const cameraLabelsRepository = new HttpCameraLabelsRepository(runtime.apiBaseUrl)
const notificationLabelsRepository = new HttpNotificationLabelsRepository(runtime.apiBaseUrl)

export const dashboardRuntime = runtime
export const getSystemStats = new GetSystemStats(systemRepository)
export const applyCamera = new ApplyCamera(cameraRepository)
export const applyCameraConfiguration = new ApplyCameraConfiguration(cameraRepository)
export const createCamera = new CreateCamera(cameraRepository)
export const deleteCamera = new DeleteCamera(cameraRepository)
export const discoverCameras = new DiscoverCameras(cameraRepository)
export const getCameras = new GetCameras(cameraRepository)
export const getCameraStatus = new GetCameraStatus(cameraRepository)
export const getHubOverview = new GetHubOverview(hubRepository)
export const getVendorAssistance = new GetVendorAssistance(cameraRepository)
export const updateCamera = new UpdateCamera(cameraRepository)
export const verifyDraftCamera = new VerifyDraftCamera(cameraRepository)
export const verifyCamera = new VerifyCamera(cameraRepository)
export const getNotificationChannelConfig = new GetNotificationChannelConfig(
  notificationSettingsRepository,
)
export const saveNotificationChannelConfig = new SaveNotificationChannelConfig(
  notificationSettingsRepository,
)
export const testNotificationChannel = new TestNotificationChannel(notificationSettingsRepository)
export const deleteNotificationChannel = new DeleteNotificationChannel(
  notificationSettingsRepository,
)
export const getNotificationLog = new GetNotificationLog(notificationSettingsRepository)

// Profile use cases
export const getProfiles = new GetProfiles(profileRepository)
export const createProfile = new CreateProfile(profileRepository)
export const updateProfile = new UpdateProfile(profileRepository)
export const deleteProfile = new DeleteProfile(profileRepository)
export const getProfilePhotos = new GetProfilePhotos(profileRepository)
export const addProfilePhoto = new AddProfilePhoto(profileRepository)
export const removeProfilePhoto = new RemoveProfilePhoto(profileRepository)
export const resyncFaceLibrary = new ResyncFaceLibrary(profileRepository)
export const getProfileCameraLinks = new GetProfileCameraLinks(profileRepository)
export const setProfileCameraLinks = new SetProfileCameraLinks(profileRepository)
export const getCameraDetectionConfig = new GetCameraDetectionConfig(profileRepository)
export const saveCameraDetectionConfig = new SaveCameraDetectionConfig(profileRepository)
export const getDetectionHistory = new GetDetectionHistory(profileRepository)
export const correctDetectionIdentity = new CorrectDetectionIdentity(profileRepository)
export const getCameraLabels = new GetDetectionLabels(cameraLabelsRepository)
export const getNotificationLabels = new GetDetectionLabels(notificationLabelsRepository)

// Privacy use cases
export const toggleCameraPrivacyMode = new ToggleCameraPrivacyMode(cameraRepository)
export const batchToggleCameraPrivacyMode = new BatchToggleCameraPrivacyMode(cameraRepository)
export const getCameraPrivacySchedules = new GetCameraPrivacySchedules(cameraRepository)
export const createCameraPrivacySchedule = new CreateCameraPrivacySchedule(cameraRepository)
export const updateCameraPrivacySchedule = new UpdateCameraPrivacySchedule(cameraRepository)
export const deleteCameraPrivacySchedule = new DeleteCameraPrivacySchedule(cameraRepository)
export const setPrivacyStrategy = new SetPrivacyStrategy(cameraRepository)

// PTZ use cases
export const ptzStep = new PtzStep(cameraRepository)
export const ptzSavePreset = new PtzSavePreset(cameraRepository)
export const ptzGoToPreset = new PtzGoToPreset(cameraRepository)
export const configurePtzParking = new ConfigurePtzParking(cameraRepository)
export const getPtzPresets = new GetPtzPresets(cameraRepository)
export const ptzSaveCurrentAsPreset = new PtzSaveCurrentAsPreset(cameraRepository)
export const ptzCalibrate = new PtzCalibrate(cameraRepository)
export const capturePtzPresetThumbnail = new CapturePtzPresetThumbnail(cameraRepository)

// Capability use cases (ADR-22)
export const getCameraCapabilities = new GetCameraCapabilities(cameraRepository)
export const configureCameraCapability = new ConfigureCameraCapability(cameraRepository)
export const probeCameraCapability = new ProbeCameraCapability(cameraRepository)
export const detectCameraCapabilities = new DetectCameraCapabilities(cameraRepository)
