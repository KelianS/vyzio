import type { DiscoveredCamera } from '../../domain/entities/discovered_camera.entity'
import type { AddCameraAction } from './add_camera.actions'
import { emptyCameraDraft, type AddCameraUido } from './add_camera.uido'

// Discovery hands over the name and the address only; credentials stay the user's own (ADR-04).
function draftFromCandidate(state: AddCameraUido, candidate: DiscoveredCamera) {
  return { ...state.form, displayName: candidate.displayName, host: candidate.host }
}

export function addCameraReducer(state: AddCameraUido, action: AddCameraAction): AddCameraUido {
  switch (action.type) {
    case 'FORM_UPDATED':
      return {
        ...state,
        form: { ...state.form, ...action.patch },
      }

    case 'SELECTION_CLEARED':
      return {
        ...state,
        selection: { kind: 'none' },
        form: emptyCameraDraft,
        helpVendor: null,
      }

    case 'MANUAL_ENTRY_SELECTED':
      return {
        ...state,
        selection: { kind: 'manual' },
        form: emptyCameraDraft,
        helpVendor: null,
      }

    case 'CANDIDATE_SELECTED':
      return {
        ...state,
        selection: { kind: 'candidate', index: action.index },
        form: draftFromCandidate(state, action.candidate),
        helpVendor: action.candidate.vendorFamily,
      }

    case 'DISCOVERY_STARTED':
      return { ...state, discovering: true }

    // Auto-selecting the first result would open a form for a camera nobody looked at yet.
    case 'DISCOVERY_SUCCEEDED':
      return {
        ...state,
        discovering: false,
        discoveryResults: action.candidates,
      }

    case 'DISCOVERY_FAILED':
      return { ...state, discovering: false }

    case 'REFRESH_CANDIDATE_STARTED':
      return { ...state, refreshing: true }

    case 'REFRESH_CANDIDATE_SUCCEEDED': {
      const results = [...state.discoveryResults]
      results[action.index] = action.candidate
      return {
        ...state,
        refreshing: false,
        discoveryResults: results,
        selection: { kind: 'candidate', index: action.index },
        form: draftFromCandidate(state, action.candidate),
        // A later scan that recognises no vendor keeps the user's pick.
        helpVendor: action.candidate.vendorFamily ?? state.helpVendor,
      }
    }

    case 'REFRESH_CANDIDATE_FINISHED':
      return { ...state, refreshing: false }

    case 'CREATE_STARTED':
      return { ...state, creating: true }

    case 'CREATE_SUCCEEDED':
      return { ...state, creating: false }

    case 'CREATE_FAILED':
      return { ...state, creating: false }

    case 'CONFIRM_SCAN_SET':
      return { ...state, confirmScan: action.value }

    case 'RANGES_TO_SWEEP_STARTED':
      return { ...state, rangesToSweep: { loading: true, ranges: [], error: null } }
    case 'RANGES_TO_SWEEP_SUCCEEDED':
      return { ...state, rangesToSweep: { loading: false, ranges: action.ranges, error: null } }
    case 'RANGES_TO_SWEEP_FAILED':
      return {
        ...state,
        rangesToSweep: { loading: false, ranges: [], error: action.error },
      }

    case 'HELP_VENDOR_CHOSEN':
      return { ...state, helpVendor: action.vendorFamily }

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
