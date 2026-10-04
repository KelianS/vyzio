import type { AppError } from '../../common/errors/app_error'
import type { AddCameraForm } from './add_camera.uido'
import type { DiscoveredCamera } from '../../domain/entities/discovered_camera.entity'

export type AddCameraAction =
  | { type: 'FORM_UPDATED'; patch: Partial<AddCameraForm> }
  | { type: 'MANUAL_ENTRY_SELECTED' }
  | { type: 'SELECTION_CLEARED' }
  | { type: 'CANDIDATE_SELECTED'; index: number; candidate: DiscoveredCamera }
  | { type: 'DISCOVERY_STARTED' }
  | { type: 'DISCOVERY_SUCCEEDED'; candidates: DiscoveredCamera[]; message: string }
  | { type: 'DISCOVERY_FAILED'; message: string; diagnostic?: string }
  | { type: 'REFRESH_CANDIDATE_STARTED' }
  | {
      type: 'REFRESH_CANDIDATE_SUCCEEDED'
      index: number
      candidate: DiscoveredCamera
      message: string
    }
  | { type: 'REFRESH_CANDIDATE_NO_CHANGE'; message: string }
  | { type: 'REFRESH_CANDIDATE_FAILED'; message: string; diagnostic?: string }
  | { type: 'VERIFY_DRAFT_STARTED' }
  | { type: 'VERIFY_DRAFT_SUCCEEDED'; connected: boolean; guidance: string | null; message: string }
  | { type: 'VERIFY_DRAFT_FAILED'; message: string; diagnostic?: string }
  | { type: 'CREATE_STARTED' }
  | { type: 'CREATE_SUCCEEDED' }
  | { type: 'CREATE_FAILED'; message: string; diagnostic?: string }
  | { type: 'CONFIRM_SCAN_SET'; value: boolean }
  | { type: 'VENDOR_ASSISTANCE_STARTED' }
  | { type: 'VENDOR_ASSISTANCE_SUCCEEDED'; markdown: string | null }
  | { type: 'VENDOR_ASSISTANCE_FAILED'; error: AppError }
  | { type: 'VENDOR_ASSISTANCE_CLEARED' }
