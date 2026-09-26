import type { Profile } from '../../domain/entities/profile.entity'

export interface PersonUido {
  person: Profile | null
  loading: boolean
}

export function buildInitialPersonUido(): PersonUido {
  return { person: null, loading: true }
}
