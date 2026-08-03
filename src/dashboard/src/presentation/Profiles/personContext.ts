import { useOutletContext } from 'react-router'
import type { Profile } from '../../domain/entities/Profile'

export interface PersonContext {
  person: Profile
  /** Une page peut renommer la personne : la coquille doit s'en apercevoir. */
  reload: () => void
}

export function usePerson(): PersonContext {
  return useOutletContext<PersonContext>()
}
