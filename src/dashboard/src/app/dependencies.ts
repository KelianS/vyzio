import { ApplyCamera } from '../application/use-cases/ApplyCamera'
import { CreateCamera } from '../application/use-cases/CreateCamera'
import { DeleteCamera } from '../application/use-cases/DeleteCamera'
import { DiscoverCameras } from '../application/use-cases/DiscoverCameras'
import { GetCameraStatus } from '../application/use-cases/GetCameraStatus'
import { GetCameras } from '../application/use-cases/GetCameras'
import { GetHubOverview } from '../application/use-cases/GetHubOverview'
import { VerifyCamera } from '../application/use-cases/VerifyCamera'
import { getDashboardRuntime } from '../infrastructure/config/runtime'
import { HttpCameraRepository } from '../infrastructure/repositories/HttpCameraRepository'
import { HttpHubRepository } from '../infrastructure/repositories/HttpHubRepository'

const runtime = getDashboardRuntime()
const hubRepository = new HttpHubRepository(runtime.apiBaseUrl)
const cameraRepository = new HttpCameraRepository(runtime.apiBaseUrl)

export const dashboardRuntime = runtime
export const applyCamera = new ApplyCamera(cameraRepository)
export const createCamera = new CreateCamera(cameraRepository)
export const deleteCamera = new DeleteCamera(cameraRepository)
export const discoverCameras = new DiscoverCameras(cameraRepository)
export const getCameras = new GetCameras(cameraRepository)
export const getCameraStatus = new GetCameraStatus(cameraRepository)
export const getHubOverview = new GetHubOverview(hubRepository)
export const verifyCamera = new VerifyCamera(cameraRepository)