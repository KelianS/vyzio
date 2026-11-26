import type { AppError } from '../../common/errors/app_error'
import type { DetectionEvent } from '../../domain/entities/detection_event.entity'
import type { DetectionLabel } from '../../domain/entities/detection_label.entity'
import type { Profile } from '../../domain/entities/profile.entity'
import { ANY_DAY, type DayFilter } from './day_filter'

/** The sheet the page shows: its filter, the playing clip's actions, or who the clip shows. */
export type DetectionSheet = 'filter' | 'actions' | 'identity'

/** An axis of the filter that holds several values at once (HIST-03). */
export type FilterAxis = 'camera' | 'profile' | 'label'

export interface DetectionHistoryUido {
  items: DetectionEvent[]
  /** What is left to read past the last shown row; null when there is nothing more. */
  nextCursor: string | null
  loaded: boolean
  profiles: Profile[]
  detectionLabels: DetectionLabel[]
  loadingMore: boolean
  /** A failed read, shown with its diagnostic line (UI-01). */
  error: AppError | null
  /** The clip in the player; null holds the most recent one (HIST-18). */
  playingId: string | null
  /** The clip in the player followed the previous one by itself: its row comes into view. */
  playedOnItsOwn: boolean
  sheet: DetectionSheet | null

  /** The values checked on each axis, none meaning all; a camera by its id, never the engine's name. */
  filters: Record<FilterAxis, string[]>
  filterDay: DayFilter

  /** The detection whose deletion waits for its confirmation. */
  deletingEventId: string | null
  /** The detection whose video turned out erased with another one. */
  clipGoneEventId: string | null
}

/** `cameraId`: the camera the page opens filtered on, from a camera view's « Toutes ses détections ». */
export function buildInitialDetectionHistoryUido(cameraId = ''): DetectionHistoryUido {
  return {
    items: [],
    nextCursor: null,
    loaded: false,
    profiles: [],
    detectionLabels: [],
    loadingMore: false,
    error: null,
    playingId: null,
    playedOnItsOwn: false,
    sheet: null,

    filters: { camera: cameraId ? [cameraId] : [], profile: [], label: [] },
    filterDay: ANY_DAY,

    deletingEventId: null,
    clipGoneEventId: null,
  }
}
