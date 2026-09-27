import type { CameraConservationAction } from './camera_conservation.actions'
import type { CameraConservationUido } from './camera_conservation.uido'

export function cameraConservationReducer(
  state: CameraConservationUido,
  action: CameraConservationAction,
): CameraConservationUido {
  switch (action.type) {
    case 'LOAD_STARTED':
      return { ...state, loading: true, error: null }
    case 'LOAD_SUCCEEDED':
      return { ...state, loading: false, config: action.config }
    case 'LOAD_FAILED':
      return { ...state, loading: false, error: action.error }
    case 'CAMERA_GONE':
      return { ...state, loading: false, config: null }

    case 'SAVE_STARTED':
      return { ...state, saving: true }
    case 'SAVE_SUCCEEDED':
      return { ...state, config: action.config }
    case 'SAVE_FINISHED':
      return { ...state, saving: false }
  }
}
