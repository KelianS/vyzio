import type { DetectionHistoryPage } from '../../domain/entities/DetectionHistory'
import type { DetectionLabel } from '../../domain/entities/DetectionLabel'
import type { Profile } from '../../domain/entities/Profile'

export interface DetectionMedia {
  type: 'image' | 'video'
  url: string
}

export interface DetectionHistoryUido {
  page: DetectionHistoryPage | null
  profiles: Profile[]
  detectionLabels: DetectionLabel[]
  loading: boolean
  error: string | null
  media: DetectionMedia | null
  /** Les filtres sont une option, pas le haut de l'ecran : replies tant qu'on ne les demande pas. */
  filtersOpen: boolean

  filterCamera: string
  filterLabel: string
  filterProfileId: string
  filterFrom: string
  filterTo: string
  currentPage: number

  correctingEventId: string | null
}

export function buildInitialDetectionHistoryUido(): DetectionHistoryUido {
  return {
    page: null,
    profiles: [],
    detectionLabels: [],
    loading: true,
    error: null,
    media: null,
    filtersOpen: false,

    filterCamera: '',
    filterLabel: '',
    filterProfileId: '',
    filterFrom: '',
    filterTo: '',
    currentPage: 1,

    correctingEventId: null,
  }
}
