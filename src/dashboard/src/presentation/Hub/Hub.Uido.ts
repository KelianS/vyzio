import type { AppError } from '../../common/errors/AppError'
import type { HubOverview } from '../../domain/entities/HubOverview'
import type { PrivacyRequest } from './privacyRequest'

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
