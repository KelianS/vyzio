import {
  CapabilityStatus,
  type CameraCapabilityBinding,
  type Capability,
} from '../../domain/entities/camera_capability_binding.entity'
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
      return { ...state, bindingsLoading: true, bindingsError: null, cameraGone: false }
    // A question stays only on a capability still to confirm: an answer or a check elsewhere closed it.
    case 'BINDINGS_LOADED':
      return {
        ...state,
        bindingsLoading: false,
        bindings: action.bindings,
        asking: stillAsking(state.asking, action.bindings),
      }
    // An unread list is not an empty one: every capability would be offered to add by hand.
    case 'BINDINGS_FAILED':
      return { ...state, bindingsLoading: false, bindings: [], bindingsError: action.error }
    case 'CAMERA_GONE':
      return { ...state, bindingsLoading: false, bindings: [], cameraGone: true }
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

    case 'QUESTION_ASKED':
      return { ...state, asking: { ...state.asking, [action.capability]: true } }
    case 'QUESTION_CLOSED': {
      const asking = { ...state.asking }
      delete asking[action.capability]
      return { ...state, asking }
    }

    case 'MANUAL_OPENED':
      return { ...state, manualFormOpen: true }
    case 'MANUAL_CLOSED':
      return { ...state, manualFormOpen: false }
    case 'MANUAL_STARTED':
      return { ...state, manualConfiguring: true }
    case 'MANUAL_FINISHED':
      return { ...state, manualConfiguring: false }

    case 'PROTOCOLS_STARTED':
      return { ...state, protocolsLoading: true, protocolsError: null }
    case 'PROTOCOLS_LOADED':
      return { ...state, protocolsLoading: false, protocols: action.protocols }
    // An unread list is not an empty one: no box would claim the camera speaks nothing.
    case 'PROTOCOLS_FAILED':
      return { ...state, protocolsLoading: false, protocols: [], protocolsError: action.error }
    case 'PROTOCOL_CHECK_STARTED':
      return { ...state, checking: { ...state.checking, [action.protocol]: true } }
    // The answer replaces its own box and leaves the others as they were read.
    case 'PROTOCOL_CHECKED':
      return {
        ...state,
        protocols: state.protocols.map((entry) =>
          entry.protocol === action.protocol.protocol ? action.protocol : entry,
        ),
      }
    case 'PROTOCOL_CHECK_FINISHED': {
      const checking = { ...state.checking }
      delete checking[action.protocol]
      return { ...state, checking }
    }

    case 'PROTOCOL_SEARCH_STARTED':
      return { ...state, searchingProtocols: true }
    case 'PROTOCOL_SEARCH_FINISHED':
      return { ...state, searchingProtocols: false }

    case 'PROTOCOL_FORM_OPENED':
      return { ...state, protocolFormOpen: true }
    case 'PROTOCOL_FORM_CLOSED':
      return { ...state, protocolFormOpen: false }
    case 'PROTOCOL_ADD_STARTED':
      return { ...state, addingProtocol: true }
    case 'PROTOCOL_ADD_FINISHED':
      return { ...state, addingProtocol: false }
    case 'PROTOCOL_REMOVE_STARTED':
      return { ...state, removing: { ...state.removing, [action.protocol]: true } }
    case 'PROTOCOL_REMOVE_FINISHED': {
      const removing = { ...state.removing }
      delete removing[action.protocol]
      return { ...state, removing }
    }
  }
}

function stillAsking(
  asking: Partial<Record<Capability, true>>,
  bindings: CameraCapabilityBinding[],
): Partial<Record<Capability, true>> {
  return Object.fromEntries(
    bindings
      .filter((b) => asking[b.capability] && b.status === CapabilityStatus.ToConfirm)
      .map((b) => [b.capability, true]),
  )
}
