import type { Profile } from '../../domain/entities/profile.entity'

export interface PersonListUido {
  people: Profile[]
  loading: boolean
}

export function buildInitialPersonListUido(): PersonListUido {
  return { people: [], loading: true }
}
