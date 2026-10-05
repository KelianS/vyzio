import type { AppError } from '../../common/errors/app_error'
import type { DetectionLabel } from '../../domain/entities/detection_label.entity'
import type { HubOverview } from '../../domain/entities/hub_overview.entity'
import type { PrivacyRequest } from './privacy_request'

export type HubAction =
  | { type: 'LOAD_STARTED' }
  | { type: 'LOAD_SUCCEEDED'; data: HubOverview }
  | { type: 'LOAD_FAILED'; error: AppError }
  | { type: 'LABELS_LOADED'; labels: DetectionLabel[] }
  | { type: 'PRIVACY_PENDING_SET'; request: PrivacyRequest | null }
  | { type: 'PRIVACY_TOGGLE_STARTED' }
  | { type: 'PRIVACY_TOGGLE_SUCCEEDED' }
  | { type: 'PRIVACY_TOGGLE_FAILED' }
