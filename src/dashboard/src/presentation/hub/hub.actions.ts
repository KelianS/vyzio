import type { CamerasCut } from '../../domain/entities/cameras_cut.entity'
import type { Silence } from '../../domain/entities/silence.entity'
import type { RecentDetections } from './home_wording'

export type HubAction =
  | { type: 'SILENCE_READ'; silence: Silence }
  | { type: 'SILENCE_READ_FAILED' }
  | { type: 'SILENCE_SHEET_SET'; open: boolean }
  | { type: 'SILENCE_CHANGE_STARTED' }
  | { type: 'SILENCE_CHANGED'; silence: Silence }
  | { type: 'SILENCE_CHANGE_FAILED' }
  | { type: 'OVERVIEW_LOADED'; activeChannels: number }
  | { type: 'DETECTIONS_COUNTED'; recent: RecentDetections }
  | { type: 'PRIVACY_STARTED'; cameraIds: readonly string[] }
  | { type: 'PRIVACY_FINISHED'; cameraIds: readonly string[] }
  | { type: 'CUT_READ'; cut: CamerasCut }
  | { type: 'CUT_SHEET_SET'; open: boolean }
