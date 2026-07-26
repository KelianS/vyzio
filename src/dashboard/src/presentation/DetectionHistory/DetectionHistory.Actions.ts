import type { DetectionHistoryPage } from '../../domain/entities/DetectionHistory'
import type { DetectionLabel } from '../../domain/entities/DetectionLabel'
import type { Profile } from '../../domain/entities/Profile'

export type DetectionHistoryAction =
  | { type: 'PROFILES_LOADED'; profiles: Profile[] }
  | { type: 'LABELS_LOADED'; labels: DetectionLabel[] }
  | { type: 'HISTORY_LOAD_STARTED' }
  | { type: 'HISTORY_LOAD_SUCCEEDED'; page: DetectionHistoryPage }
  | { type: 'HISTORY_LOAD_FAILED' }
  | { type: 'FILTER_CAMERA_SET'; value: string }
  | { type: 'FILTER_LABEL_SET'; value: string }
  | { type: 'FILTER_PROFILE_SET'; value: string }
  | { type: 'FILTER_FROM_SET'; value: string }
  | { type: 'FILTER_TO_SET'; value: string }
  | { type: 'FILTERS_RESET' }
  | { type: 'PAGE_SET'; page: number }
  | { type: 'SNAPSHOT_SET'; url: string | null }
  | { type: 'CORRECT_STARTED'; eventId: string }
  | { type: 'CORRECT_SUCCEEDED'; page: DetectionHistoryPage }
  | { type: 'CORRECT_FAILED' }
