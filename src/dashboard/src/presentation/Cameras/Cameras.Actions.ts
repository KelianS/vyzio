import type { AppError } from '../../common/errors/AppError'
import type { CameraDraftInput } from '../../domain/entities/CameraDraftInput'
import type {
  CameraRetention,
  DetectionConfig,
  MotionSensitivity,
} from '../../domain/entities/DetectionConfig'
import type { DetectionLabel } from '../../domain/entities/DetectionLabel'
import type { DiscoveredCamera } from '../../domain/entities/DiscoveredCamera'

export type CamerasAction =
  | { type: 'FORM_UPDATED'; patch: Partial<CameraDraftInput> }
  | { type: 'EDIT_FORM_UPDATED'; patch: Partial<CameraDraftInput> }
  | { type: 'EDIT_PASSWORD_CHANGED'; value: string }
  | { type: 'MANUAL_ENTRY_SELECTED' }
  | { type: 'GENERAL_SETTINGS_SELECTED' }
  | { type: 'CANDIDATE_SELECTED'; index: number; candidate: DiscoveredCamera }
  | { type: 'CAMERA_SELECTED'; cameraId: string }
  | {
      type: 'DVRIP_MODE_TOGGLED'
      enabled: boolean
      fallbackPort: number
      fallbackStreamPath: string | null
    }
  | { type: 'ALL_DETECTION_LABELS_LOADED'; labels: DetectionLabel[] }
  | { type: 'DETECTION_CONFIG_LOAD_STARTED'; editForm: CameraDraftInput }
  | { type: 'DETECTION_CONFIG_LOADED'; config: DetectionConfig | null; strategy: string }
  | { type: 'DETECTION_LABELS_TOGGLED'; labels: string[] }
  | { type: 'DETECTION_RETENTION_CHANGED'; retention: CameraRetention }
  | { type: 'MOTION_SENSITIVITY_CHANGED'; value: MotionSensitivity }
  | { type: 'MOTION_SENSITIVITY_PIN_TOGGLED'; pinned: boolean }
  | { type: 'DETECT_STREAM_CHANGED'; streamId: string | null }
  | { type: 'DISCOVERY_STARTED' }
  | {
      type: 'DISCOVERY_SUCCEEDED'
      candidates: DiscoveredCamera[]
      message: string
      selectFirst: boolean
    }
  | { type: 'DISCOVERY_FAILED'; message: string }
  | { type: 'CREATE_STARTED' }
  | { type: 'CREATE_SUCCEEDED'; cameraId: string }
  | { type: 'CREATE_FAILED'; message: string }
  | { type: 'VERIFY_DRAFT_STARTED' }
  | { type: 'VERIFY_DRAFT_SUCCEEDED'; connected: boolean; guidance: string | null; message: string }
  | { type: 'VERIFY_DRAFT_FAILED'; message: string }
  | { type: 'VERIFY_STARTED' }
  | { type: 'VERIFY_SUCCEEDED'; message: string }
  | { type: 'VERIFY_FAILED'; message: string }
  | { type: 'REFRESH_CANDIDATE_STARTED' }
  | {
      type: 'REFRESH_CANDIDATE_SUCCEEDED'
      index: number
      candidate: DiscoveredCamera
      message: string
    }
  | { type: 'REFRESH_CANDIDATE_NO_CHANGE'; message: string }
  | { type: 'REFRESH_CANDIDATE_FAILED'; message: string }
  | { type: 'DELETE_STARTED' }
  | { type: 'DELETE_SUCCEEDED' }
  | { type: 'DELETE_FAILED'; message: string }
  | { type: 'UPDATE_STARTED' }
  | { type: 'UPDATE_SUCCEEDED' }
  | { type: 'UPDATE_FAILED'; message: string }
  | { type: 'APPLY_STARTED' }
  | { type: 'APPLY_SUCCEEDED' }
  | { type: 'APPLY_NOT_APPLIED'; scope: 'form' | 'detail'; message: string }
  | { type: 'APPLY_FAILED'; scope: 'form' | 'detail'; message: string }
  | { type: 'STRATEGY_PENDING_CHANGED'; value: string }
  | { type: 'SAVE_STRATEGY_STARTED' }
  | { type: 'SAVE_STRATEGY_SUCCEEDED' }
  | { type: 'SAVE_STRATEGY_FAILED'; message: string }
  | { type: 'CONFIRM_DELETE_SET'; value: boolean }
  | { type: 'CONFIRM_SCAN_SET'; value: boolean }
  | { type: 'CONFIRM_APPLY_SET'; value: boolean }
  | { type: 'TOAST_ERROR_RAISED'; error: AppError }
