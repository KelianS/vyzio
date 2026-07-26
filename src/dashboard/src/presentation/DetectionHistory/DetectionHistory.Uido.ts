import type { DetectionHistoryPage } from '../../domain/entities/DetectionHistory'
import type { DetectionLabel } from '../../domain/entities/DetectionLabel'
import type { Profile } from '../../domain/entities/Profile'

export interface DetectionHistoryUido {
  page: DetectionHistoryPage | null
  profiles: Profile[]
  detectionLabels: DetectionLabel[]
  loading: boolean
  error: string | null
  snapshotUrl: string | null

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
    snapshotUrl: null,

    filterCamera: '',
    filterLabel: '',
    filterProfileId: '',
    filterFrom: '',
    filterTo: '',
    currentPage: 1,

    correctingEventId: null,
  }
}
