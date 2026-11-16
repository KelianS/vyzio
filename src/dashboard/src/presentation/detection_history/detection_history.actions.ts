import type { AppError } from '../../common/errors/app_error'
import type { DetectionHistoryPage } from '../../domain/entities/detection_history.entity'
import type { DetectionLabel } from '../../domain/entities/detection_label.entity'
import type { Profile } from '../../domain/entities/profile.entity'
import type { DayFilter } from './day_filter'
import type { DetectionSheet, FilterAxis } from './detection_history.uido'

export type DetectionHistoryAction =
  | { type: 'PROFILES_LOADED'; profiles: Profile[] }
  | { type: 'LABELS_LOADED'; labels: DetectionLabel[] }
  | { type: 'HISTORY_LOAD_STARTED' }
  | { type: 'HISTORY_LOAD_SUCCEEDED'; page: DetectionHistoryPage }
  | { type: 'HISTORY_LOAD_FAILED'; error: AppError }
  | { type: 'HISTORY_MORE_STARTED' }
  | { type: 'HISTORY_MORE_SUCCEEDED'; page: DetectionHistoryPage }
  | { type: 'HISTORY_MORE_FAILED' }
  | { type: 'FILTER_TOGGLED'; axis: FilterAxis; value: string }
  | { type: 'FILTER_CLEARED'; axis: FilterAxis }
  | { type: 'FILTER_DAY_SET'; day: DayFilter }
  | { type: 'FILTERS_RESET' }
  | { type: 'CLIP_PLAYED'; eventId: string }
  | { type: 'CLIP_ENDED'; eventId: string }
  | { type: 'SHEET_OPENED'; sheet: DetectionSheet }
  | { type: 'SHEET_CLOSED' }
  | {
      type: 'CORRECT_SUCCEEDED'
      eventId: string
      identity: string | null
      profileId: string | null
    }
  | { type: 'DELETE_ASKED'; eventId: string }
  | { type: 'DELETE_DISMISSED' }
  | { type: 'DELETE_SUCCEEDED'; eventId: string }
  | { type: 'CLIP_GONE'; eventId: string }
