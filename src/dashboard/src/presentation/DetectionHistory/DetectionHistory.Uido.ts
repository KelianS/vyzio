import type { DetectionEvent } from '../../domain/entities/DetectionEvent'
import type { DetectionLabel } from '../../domain/entities/DetectionLabel'
import type { Profile } from '../../domain/entities/Profile'

export interface DetectionMedia {
  type: 'image' | 'video'
  url: string
}

export interface DetectionHistoryUido {
  items: DetectionEvent[]
  /** What is left to read past the last shown row; null when there is nothing more. */
  nextCursor: string | null
  loaded: boolean
  profiles: Profile[]
  detectionLabels: DetectionLabel[]
  loading: boolean
  loadingMore: boolean
  /** A failed read: its sentence, and the diagnostic line support reads (SPECS 1.5). */
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
  }
}
