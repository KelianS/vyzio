import type { AppError } from '../../common/errors/app_error'
import type { Profile } from '../../domain/entities/profile.entity'

export interface PersonUido {
  person: Profile | null
  loading: boolean
  error: AppError | null
}

export function buildInitialPersonUido(): PersonUido {
  return { person: null, loading: true, error: null }
}
