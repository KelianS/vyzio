import type { AppError } from '../../common/errors/AppError'
import type { HubOverview } from '../../domain/entities/HubOverview'
import type { PrivacyRequest } from './privacyRequest'

export type HubAction =
  | { type: 'LOAD_STARTED' }
  | { type: 'LOAD_SUCCEEDED'; data: HubOverview }
  | { type: 'LOAD_FAILED'; error: AppError }
  | { type: 'PRIVACY_PENDING_SET'; request: PrivacyRequest | null }
  | { type: 'PRIVACY_TOGGLE_STARTED' }
  | { type: 'PRIVACY_TOGGLE_SUCCEEDED' }
  | { type: 'PRIVACY_TOGGLE_FAILED' }
