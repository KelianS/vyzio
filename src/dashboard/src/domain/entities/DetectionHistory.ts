import type { DetectionEvent } from './DetectionEvent'

export interface DetectionHistoryPage {
  items: DetectionEvent[]
  /** Null once the oldest detection is reached: the history pages by date (ADR-49). */
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
