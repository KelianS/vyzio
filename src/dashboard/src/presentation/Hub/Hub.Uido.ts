import type { AppError } from '../../common/errors/AppError'
import type { HubOverview } from '../../domain/entities/HubOverview'

export interface HubUido {
  data: HubOverview | null
  loading: boolean
  error: AppError | null
  batchPending: boolean | null
  batchToggleLoading: boolean
}

export function buildInitialHubUido(): HubUido {
  return {
    data: null,
    loading: true,
    error: null,
    batchPending: null,
    batchToggleLoading: false,
  }
}
