import type { AppError } from '../../common/errors/app_error'
import type { AccessState, CurrentSession } from '../../domain/entities/access.entity'

export type AccessGateAction =
  | { type: 'LOAD_STARTED' }
  | { type: 'LOAD_SUCCEEDED'; state: AccessState; session: CurrentSession | null }
  | { type: 'LOAD_FAILED'; error: AppError }
  | { type: 'SESSION_LOST' }
  | { type: 'CREATE_STARTED' }
  | { type: 'CREATE_FINISHED' }
  | { type: 'SIGN_IN_STARTED' }
  | { type: 'SIGN_IN_REFUSED' }
  | { type: 'SIGN_IN_FINISHED' }
