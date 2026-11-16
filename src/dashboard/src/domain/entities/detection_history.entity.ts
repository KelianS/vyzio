import type { DetectionEvent } from './detection_event.entity'

export interface DetectionHistoryPage {
  items: DetectionEvent[]
  /** Null once the oldest detection is reached: the history pages by date (ADR-12). */
  nextCursor: string | null
}

/** Each list keeps a detection matching any of its values; an empty or missing one filters nothing. */
export interface DetectionHistoryQuery {
  /** The engine's names of the cameras. */
  cameras?: readonly string[]
  labels?: readonly string[]
  profileIds?: readonly string[]
  from?: string
  to?: string
  cursor?: string
  limit?: number
}
