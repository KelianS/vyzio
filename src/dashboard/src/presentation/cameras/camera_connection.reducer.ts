import type { CameraConnectionAction } from './camera_connection.actions'
import type { CameraConnectionUido } from './camera_connection.uido'

export function cameraConnectionReducer(
  state: CameraConnectionUido,
  action: CameraConnectionAction,
): CameraConnectionUido {
  switch (action.type) {
    case 'SAVE_STARTED':
      return { ...state, saving: true }
    case 'SAVE_FINISHED':
      return { ...state, saving: false }
    case 'VERIFY_STARTED':
      return { ...state, verifying: true }
    case 'VERIFY_FINISHED':
      return { ...state, verifying: false }

    case 'DELETE_ASKED':
      return { ...state, confirmDelete: true }
    case 'DELETE_CANCELLED':
      return { ...state, confirmDelete: false }
    case 'DELETE_STARTED':
      return { ...state, deleting: true }
    // Success or failure, the question has been answered.
    case 'DELETE_FINISHED':
      return { ...state, deleting: false, confirmDelete: false }

    case 'BINDINGS_STARTED':
      return { ...state, bindingsLoading: true }
    case 'BINDINGS_LOADED':
      return { ...state, bindingsLoading: false, bindings: action.bindings }
    case 'BINDINGS_FAILED':
      return { ...state, bindingsLoading: false, bindings: [] }
    case 'DETECT_STARTED':
      return { ...state, detecting: true }
    case 'DETECT_FINISHED':
      return { ...state, detecting: false }

    case 'TASK_STARTED':
      return { ...state, pending: { ...state.pending, [action.capability]: action.task } }
    case 'TASK_FINISHED': {
      const pending = { ...state.pending }
      delete pending[action.capability]
      return { ...state, pending }
    }

    case 'MANUAL_OPENED':
      return { ...state, manualFormOpen: true }
    case 'MANUAL_CLOSED':
      return { ...state, manualFormOpen: false }
    case 'MANUAL_STARTED':
      return { ...state, manualConfiguring: true }
    case 'MANUAL_FINISHED':
      return { ...state, manualConfiguring: false }
  }
}
