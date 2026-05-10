import { GetHubOverview } from '../application/use-cases/GetHubOverview'
import { getDashboardRuntime } from '../infrastructure/config/runtime'
import { HttpHubRepository } from '../infrastructure/repositories/HttpHubRepository'

const runtime = getDashboardRuntime()
const hubRepository = new HttpHubRepository(runtime.apiBaseUrl)

export const dashboardRuntime = runtime
export const getHubOverview = new GetHubOverview(hubRepository)