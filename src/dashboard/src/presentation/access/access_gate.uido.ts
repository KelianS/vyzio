import type { AppError } from '../../common/errors/app_error'
import type { AccessState, CurrentSession } from '../../domain/entities/access.entity'

export interface AccessGateUido {
  state: AccessState | null
  session: CurrentSession | null
  loading: boolean
  error: AppError | null
  /** A session ended while a screen was open: sign-in says so. */
  expired: boolean
  creating: boolean
  signingIn: boolean
  /** A refused password is not a failure: the screen says so and lets them try again. */
  refused: boolean
}

export function buildInitialAccessGateUido(): AccessGateUido {
  return {
    state: null,
    session: null,
    loading: true,
    error: null,
    expired: false,
    creating: false,
    signingIn: false,
    refused: false,
  }
}
