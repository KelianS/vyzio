import type { AccessGateAction } from './access_gate.actions'
import type { AccessGateUido } from './access_gate.uido'

export function accessGateReducer(state: AccessGateUido, action: AccessGateAction): AccessGateUido {
  switch (action.type) {
    // Reopening after a sign-in starts over: the expired notice has done its job.
    case 'LOAD_STARTED':
      return { ...state, loading: true, error: null, expired: false }
    case 'LOAD_SUCCEEDED':
      return { ...state, loading: false, state: action.state, session: action.session }
    case 'LOAD_FAILED':
      return { ...state, loading: false, error: action.error }
    case 'SESSION_LOST':
      return { ...state, expired: true }

    case 'CREATE_STARTED':
      return { ...state, creating: true }
    case 'CREATE_FINISHED':
      return { ...state, creating: false }
    case 'SIGN_IN_STARTED':
      return { ...state, signingIn: true, refused: false }
    case 'SIGN_IN_REFUSED':
      return { ...state, refused: true }
    case 'SIGN_IN_FINISHED':
      return { ...state, signingIn: false }
  }
}
