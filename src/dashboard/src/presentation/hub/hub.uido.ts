import type { AppError } from '../../common/errors/app_error'
import type { HubOverview } from '../../domain/entities/hub_overview.entity'
import type { PrivacyRequest } from './privacy_request'

export interface HubUido {
  data: HubOverview | null
  loading: boolean
  error: AppError | null
  privacyPending: PrivacyRequest | null
  privacyLoading: boolean
}

export function buildInitialHubUido(): HubUido {
  return {
    data: null,
    loading: true,
    error: null,
    privacyPending: null,
    privacyLoading: false,
  }
}
