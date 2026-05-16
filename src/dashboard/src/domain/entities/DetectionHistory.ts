import type { DetectionEvent } from './DetectionEvent'

export interface DetectionHistoryPage {
  items: DetectionEvent[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface DetectionHistoryQuery {
  camera?: string
  label?: string
  profileId?: string
  from?: string
  to?: string
  page?: number
  limit?: number
}
