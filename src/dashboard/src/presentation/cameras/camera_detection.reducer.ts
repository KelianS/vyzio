import type { CameraDetectionAction } from './camera_detection.actions'
import type { CameraDetectionUido } from './camera_detection.uido'

export function cameraDetectionReducer(
  state: CameraDetectionUido,
  action: CameraDetectionAction,
): CameraDetectionUido {
  switch (action.type) {
    case 'LOAD_STARTED':
      return { ...state, loading: true, error: null }
    case 'LOAD_SUCCEEDED':
      return { ...state, loading: false, config: action.config, labels: action.labels }
    case 'LOAD_FAILED':
      return { ...state, loading: false, error: action.error }

    case 'SAVE_STARTED':
      return { ...state, saving: true }
    case 'SAVE_FINISHED':
      return { ...state, saving: false }
  }
}
