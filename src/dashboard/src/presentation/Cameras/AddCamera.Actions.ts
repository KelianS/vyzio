import type { CameraDraftInput } from '../../domain/entities/CameraDraftInput'
import type { DiscoveredCamera } from '../../domain/entities/DiscoveredCamera'

export type AddCameraAction =
  | { type: 'FORM_UPDATED'; patch: Partial<CameraDraftInput> }
  | { type: 'MANUAL_ENTRY_SELECTED' }
  | { type: 'CANDIDATE_SELECTED'; index: number; candidate: DiscoveredCamera }
  | {
      type: 'DVRIP_MODE_TOGGLED'
      enabled: boolean
      fallbackPort: number
      fallbackStreamPath: string | null
    }
  | { type: 'DISCOVERY_STARTED' }
  | {
      type: 'DISCOVERY_SUCCEEDED'
      candidates: DiscoveredCamera[]
      message: string
      selectFirst: boolean
    }
  | { type: 'DISCOVERY_FAILED'; message: string }
  | { type: 'REFRESH_CANDIDATE_STARTED' }
  | {
      type: 'REFRESH_CANDIDATE_SUCCEEDED'
      index: number
      candidate: DiscoveredCamera
      message: string
    }
  | { type: 'REFRESH_CANDIDATE_NO_CHANGE'; message: string }
  | { type: 'REFRESH_CANDIDATE_FAILED'; message: string }
  | { type: 'VERIFY_DRAFT_STARTED' }
  | { type: 'VERIFY_DRAFT_SUCCEEDED'; connected: boolean; guidance: string | null; message: string }
  | { type: 'VERIFY_DRAFT_FAILED'; message: string }
  | { type: 'CREATE_STARTED' }
  | { type: 'CREATE_SUCCEEDED' }
  | { type: 'CREATE_FAILED'; message: string }
  | { type: 'CONFIRM_SCAN_SET'; value: boolean }
