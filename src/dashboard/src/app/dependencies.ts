import { ApplyCamera } from '../application/use-cases/ApplyCamera'
import { ApplyCameraConfiguration } from '../application/use-cases/ApplyCameraConfiguration'
import { CreateCamera } from '../application/use-cases/CreateCamera'
import { DeleteCamera } from '../application/use-cases/DeleteCamera'
import { DeleteNotificationChannel } from '../application/use-cases/DeleteNotificationChannel'
import { DiscoverCameras } from '../application/use-cases/DiscoverCameras'
import { GetCameraStatus } from '../application/use-cases/GetCameraStatus'
import { GetCameras } from '../application/use-cases/GetCameras'
import { GetHubOverview } from '../application/use-cases/GetHubOverview'
import { GetNotificationLog } from '../application/use-cases/GetNotificationLog'
import { GetNotificationChannelConfig } from '../application/use-cases/GetNotificationChannelConfig'
import { GetVendorAssistance } from '../application/use-cases/GetVendorAssistance'
import { SaveNotificationChannelConfig } from '../application/use-cases/SaveNotificationChannelConfig'
import { TestNotificationChannel } from '../application/use-cases/TestNotificationChannel'
import { UpdateCamera } from '../application/use-cases/UpdateCamera'
import { VerifyDraftCamera } from '../application/use-cases/VerifyDraftCamera'
import { VerifyCamera } from '../application/use-cases/VerifyCamera'
import { getDashboardRuntime } from '../infrastructure/config/runtime'
import { HttpCameraRepository } from '../infrastructure/repositories/HttpCameraRepository'
import { HttpHubRepository } from '../infrastructure/repositories/HttpHubRepository'
import { HttpNotificationSettingsRepository } from '../infrastructure/repositories/HttpNotificationSettingsRepository'

const runtime = getDashboardRuntime()
const hubRepository = new HttpHubRepository(runtime.apiBaseUrl)
const cameraRepository = new HttpCameraRepository(runtime.apiBaseUrl)
const notificationSettingsRepository = new HttpNotificationSettingsRepository(runtime.apiBaseUrl)

export const dashboardRuntime = runtime
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
