import type { AppError } from '../../common/errors/app_error'
import type { Profile } from '../../domain/entities/profile.entity'

export type PersonAction =
  | { type: 'LOAD_STARTED' }
  | { type: 'LOAD_SUCCEEDED'; people: Profile[]; profileId: string }
  | { type: 'LOAD_FAILED'; error: AppError }
