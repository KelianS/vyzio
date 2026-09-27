import type { AppError } from '../../common/errors/app_error'
import type { Profile } from '../../domain/entities/profile.entity'

export interface PersonListUido {
  people: Profile[]
  loading: boolean
  error: AppError | null
}

export function buildInitialPersonListUido(): PersonListUido {
  return { people: [], loading: true, error: null }
}
