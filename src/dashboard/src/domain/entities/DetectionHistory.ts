import type { DetectionEvent } from './DetectionEvent'

export interface DetectionHistoryPage {
  items: DetectionEvent[]
  /** Null quand la plus ancienne detection est atteinte : l'historique se pagine par date (ADR-49). */
  nextCursor: string | null
}

export interface DetectionHistoryQuery {
  camera?: string
  label?: string
  profileId?: string
  from?: string
  to?: string
  cursor?: string
  limit?: number
}
