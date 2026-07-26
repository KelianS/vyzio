import type { AppError } from '../../common/errors/AppError'
import type { HubOverview } from '../../domain/entities/HubOverview'

export type HubAction =
  | { type: 'LOAD_STARTED' }
  | { type: 'LOAD_SUCCEEDED'; data: HubOverview }
  | { type: 'LOAD_FAILED'; error: AppError }
  | { type: 'BATCH_PENDING_SET'; value: boolean | null }
  | { type: 'BATCH_TOGGLE_STARTED' }
  | { type: 'BATCH_TOGGLE_SUCCEEDED' }
  | { type: 'BATCH_TOGGLE_FAILED' }
