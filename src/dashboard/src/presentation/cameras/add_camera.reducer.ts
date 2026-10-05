import { StreamProtocol } from '../../domain/entities/camera_capability_binding.entity'
import type { DiscoveredCamera } from '../../domain/entities/discovered_camera.entity'
import type { AddCameraAction } from './add_camera.actions'
import { emptyCameraDraft, type AddCameraUido } from './add_camera.uido'

// What a candidate dictates on the form; credentials stay the user's own.
function draftFromCandidate(state: AddCameraUido, candidate: DiscoveredCamera) {
  return {
    ...state.form,
    displayName: candidate.displayName,
    host: candidate.host,
    sourceType: candidate.sourceType,
    vendorFamily: candidate.vendorFamily,
    // The stream discovery found ready, whatever its protocol, is the one the camera is born with (ADR-61 b).
    port: candidate.stream?.port ?? candidate.port,
    streamPath: candidate.stream ? candidate.stream.path : candidate.streamPath,
    streamProtocol: candidate.stream?.protocol ?? StreamProtocol.Rtsp,
  }
}

export function addCameraReducer(state: AddCameraUido, action: AddCameraAction): AddCameraUido {
  switch (action.type) {
    case 'FORM_UPDATED':
      // Editing invalidates the verification, which was for the previous values.
      return {
        ...state,
        form: { ...state.form, ...action.patch },
        verification: null,
        message: null,
        error: null,
      }

    case 'SELECTION_CLEARED':
      return {
        ...state,
        selection: { kind: 'none' },
        form: emptyCameraDraft,
        verification: null,
        message: null,
        error: null,
      }

    case 'MANUAL_ENTRY_SELECTED':
      return {
        ...state,
        selection: { kind: 'manual' },
        form: emptyCameraDraft,
        verification: null,
        message: null,
        error: null,
      }

    case 'CANDIDATE_SELECTED':
      return {
        ...state,
        selection: { kind: 'candidate', index: action.index },
        form: draftFromCandidate(state, action.candidate),
        verification: null,
        message: null,
        error: null,
      }

    // The previous search's ranges would sit next to this one's failure.
    case 'DISCOVERY_STARTED':
      return { ...state, discovering: true, sweptRanges: null, message: null, error: null }

    // Auto-selecting the first result would open a form for a camera nobody looked at yet.
    case 'DISCOVERY_SUCCEEDED':
      return {
        ...state,
        discovering: false,
        discoveryResults: action.candidates,
        sweptRanges: action.ranges,
        message: action.message,
      }

    case 'DISCOVERY_FAILED':
      return {
        ...state,
        discovering: false,
        error: { message: action.message, diagnostic: action.diagnostic },
      }

    case 'REFRESH_CANDIDATE_STARTED':
      return { ...state, refreshing: true, message: null, error: null }

    case 'REFRESH_CANDIDATE_SUCCEEDED': {
      const results = [...state.discoveryResults]
      results[action.index] = action.candidate
      return {
        ...state,
        refreshing: false,
        discoveryResults: results,
        selection: { kind: 'candidate', index: action.index },
        form: draftFromCandidate(state, action.candidate),
        verification: null,
        message: action.message,
      }
    }

    case 'REFRESH_CANDIDATE_NO_CHANGE':
      return { ...state, refreshing: false, message: action.message }

    case 'REFRESH_CANDIDATE_FAILED':
      return {
        ...state,
        refreshing: false,
        error: { message: action.message, diagnostic: action.diagnostic },
      }

    case 'VERIFY_DRAFT_STARTED':
      return { ...state, verifying: true, message: null, error: null }

    case 'VERIFY_DRAFT_SUCCEEDED':
      return action.connected
        ? {
            ...state,
            verifying: false,
            verification: { connected: true, guidance: action.guidance },
            message: action.message,
          }
        : { ...state, verifying: false, verification: null, error: { message: action.message } }

    case 'VERIFY_DRAFT_FAILED':
      return {
        ...state,
        verifying: false,
        verification: null,
        error: { message: action.message, diagnostic: action.diagnostic },
      }

    case 'CREATE_STARTED':
      return { ...state, creating: true, message: null, error: null }

    case 'CREATE_SUCCEEDED':
      return { ...state, creating: false }

    case 'CREATE_FAILED':
      return {
        ...state,
        creating: false,
        error: { message: action.message, diagnostic: action.diagnostic },
      }

    case 'CONFIRM_SCAN_SET':
      return { ...state, confirmScan: action.value }

    case 'VENDOR_ASSISTANCE_STARTED':
      return { ...state, vendorAssistance: { loading: true, markdown: null, error: null } }
    case 'VENDOR_ASSISTANCE_SUCCEEDED':
      return {
        ...state,
        vendorAssistance: { loading: false, markdown: action.markdown, error: null },
      }
    case 'VENDOR_ASSISTANCE_FAILED':
      return { ...state, vendorAssistance: { loading: false, markdown: null, error: action.error } }
    case 'VENDOR_ASSISTANCE_CLEARED':
      return { ...state, vendorAssistance: { loading: false, markdown: null, error: null } }
  }
}
