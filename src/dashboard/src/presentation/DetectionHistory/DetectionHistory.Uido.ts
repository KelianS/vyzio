import type { DetectionEvent } from '../../domain/entities/DetectionEvent'
import type { DetectionLabel } from '../../domain/entities/DetectionLabel'
import type { Profile } from '../../domain/entities/Profile'

export interface DetectionMedia {
  type: 'image' | 'video'
  url: string
}

export interface DetectionHistoryUido {
  items: DetectionEvent[]
  /** Ce qui reste a lire au-dela de la derniere ligne affichee ; null quand il n'y a plus rien. */
  nextCursor: string | null
  loaded: boolean
  profiles: Profile[]
  detectionLabels: DetectionLabel[]
  loading: boolean
  loadingMore: boolean
  error: string | null
  media: DetectionMedia | null
  /** Les filtres sont une option, pas le haut de l'ecran : replies tant qu'on ne les demande pas. */
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
