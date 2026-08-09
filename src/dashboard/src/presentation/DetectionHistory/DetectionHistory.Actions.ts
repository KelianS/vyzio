import type { DetectionHistoryPage } from '../../domain/entities/DetectionHistory'
import type { DetectionLabel } from '../../domain/entities/DetectionLabel'
import type { Profile } from '../../domain/entities/Profile'
import type { DetectionMedia } from './DetectionHistory.Uido'

export type DetectionHistoryAction =
  | { type: 'PROFILES_LOADED'; profiles: Profile[] }
  | { type: 'LABELS_LOADED'; labels: DetectionLabel[] }
  | { type: 'HISTORY_LOAD_STARTED' }
  | { type: 'HISTORY_LOAD_SUCCEEDED'; page: DetectionHistoryPage }
  | { type: 'HISTORY_LOAD_FAILED' }
  | { type: 'HISTORY_MORE_STARTED' }
  | { type: 'HISTORY_MORE_SUCCEEDED'; page: DetectionHistoryPage }
  | { type: 'HISTORY_MORE_FAILED' }
  | { type: 'FILTER_CAMERA_SET'; value: string }
  | { type: 'FILTER_LABEL_SET'; value: string }
  | { type: 'FILTER_PROFILE_SET'; value: string }
  | { type: 'FILTER_FROM_SET'; value: string }
  | { type: 'FILTER_TO_SET'; value: string }
  | { type: 'FILTERS_RESET' }
  | { type: 'MEDIA_SET'; media: DetectionMedia | null }
  | { type: 'FILTERS_TOGGLED' }
  | { type: 'CORRECT_STARTED'; eventId: string }
  | { type: 'CORRECT_SUCCEEDED'; eventId: string; identity: string | null; profileId: string | null }
  | { type: 'CORRECT_FAILED' }
