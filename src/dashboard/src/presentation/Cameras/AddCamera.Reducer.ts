import type { DiscoveredCamera } from '../../domain/entities/DiscoveredCamera'
import type { AddCameraAction } from './AddCamera.Actions'
import { emptyCameraDraft, type AddCameraUido } from './AddCamera.Uido'

// Ce qu'un candidat dicte du formulaire. Le reste (identifiants) reste a l'utilisateur.
function draftFromCandidate(state: AddCameraUido, candidate: DiscoveredCamera) {
  return {
    ...state.form,
    displayName: candidate.displayName,
    host: candidate.host,
    port: candidate.port,
    sourceType: candidate.sourceType,
    streamPath: candidate.streamPath,
    vendorFamily: candidate.vendorFamily,
    streamProtocol: 'rtsp',
  }
}

export function addCameraReducer(state: AddCameraUido, action: AddCameraAction): AddCameraUido {
  switch (action.type) {
    case 'FORM_UPDATED':
      // Une verification porte sur des valeurs precises : les changer la perime.
      return {
        ...state,
        form: { ...state.form, ...action.patch },
        verification: null,
        message: null,
        error: null,
      }

    case 'MANUAL_ENTRY_SELECTED':
      return {
        ...state,
        selection: { kind: 'manual' },
        form: emptyCameraDraft,
        dvripMode: false,
        verification: null,
        message: null,
        error: null,
      }

    case 'CANDIDATE_SELECTED':
      return {
        ...state,
        selection: { kind: 'candidate', index: action.index },
        form: draftFromCandidate(state, action.candidate),
        dvripMode: false,
        verification: null,
        message: null,
        error: null,
      }

    case 'DVRIP_MODE_TOGGLED':
      return {
        ...state,
        dvripMode: action.enabled,
        verification: null,
        message: null,
        error: null,
        form: action.enabled
          ? { ...state.form, port: 34567, streamPath: null, streamProtocol: 'dvrip' }
          : {
              ...state.form,
              port: action.fallbackPort,
              streamPath: action.fallbackStreamPath,
              streamProtocol: 'rtsp',
            },
      }

    case 'DISCOVERY_STARTED':
      return { ...state, discovering: true, message: null, error: null }

    case 'DISCOVERY_SUCCEEDED': {
      const base = {
        ...state,
        discovering: false,
        discoveryResults: action.candidates,
        message: action.message,
      }
      if (!action.selectFirst) return base
      return {
        ...base,
        selection: { kind: 'candidate' as const, index: 0 },
        form: draftFromCandidate(state, action.candidates[0]),
        dvripMode: false,
        verification: null,
      }
    }

    case 'DISCOVERY_FAILED':
      return { ...state, discovering: false, error: action.message }

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
        dvripMode: false,
        verification: null,
        message: action.message,
      }
    }

    case 'REFRESH_CANDIDATE_NO_CHANGE':
      return { ...state, refreshing: false, message: action.message }

    case 'REFRESH_CANDIDATE_FAILED':
      return { ...state, refreshing: false, error: action.message }

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
        : { ...state, verifying: false, verification: null, error: action.message }

    case 'VERIFY_DRAFT_FAILED':
      return { ...state, verifying: false, verification: null, error: action.message }

    case 'CREATE_STARTED':
      return { ...state, creating: true, message: null, error: null }

    case 'CREATE_SUCCEEDED':
      return { ...state, creating: false }

    case 'CREATE_FAILED':
      return { ...state, creating: false, error: action.message }

    case 'CONFIRM_SCAN_SET':
      return { ...state, confirmScan: action.value }
  }
}
