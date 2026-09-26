import type { Profile } from '../../domain/entities/profile.entity'

export type PersonListAction =
  { type: 'LOAD_SUCCEEDED'; people: Profile[] } | { type: 'LOAD_FAILED' }
