import type { DetectionEvent } from '../../domain/entities/detection_event.entity'
import type { DetectionLabel } from '../../domain/entities/detection_label.entity'
import type { Profile } from '../../domain/entities/profile.entity'
import type { DetectionMedia } from '../../common/detection/detection_preview'

export interface DetectionHistoryUido {
  items: DetectionEvent[]
  /** What is left to read past the last shown row; null when there is nothing more. */
  nextCursor: string | null
  loaded: boolean
  profiles: Profile[]
  detectionLabels: DetectionLabel[]
  loading: boolean
  loadingMore: boolean
  /** A failed read: its sentence, and the diagnostic line support reads (UI-01). */
  error: { message: string; diagnostic?: string } | null
  media: DetectionMedia | null
  /** Filters are an option, not the top of the screen: folded until they are asked for. */
  filtersOpen: boolean

  filterCamera: string
  filterLabel: string
  filterProfileId: string
  filterFrom: string
  filterTo: string

  correctingEventId: string | null
  /** The detection whose deletion waits for its confirmation. */
  deletingEventId: string | null
  /** The detection whose video turned out erased with another one. */
  clipGoneEventId: string | null
}

export function buildInitialDetectionHistoryUido(): DetectionHistoryUido {
  return {
    items: [],
    nextCursor: null,
    loaded: false,
    profiles: [],
    detectionLabels: [],
    loading: true,
    loadingMore: false,
    error: null,
    media: null,
    filtersOpen: false,

    filterCamera: '',
    filterLabel: '',
    filterProfileId: '',
    filterFrom: '',
    filterTo: '',

    correctingEventId: null,
    deletingEventId: null,
    clipGoneEventId: null,
  }
}
