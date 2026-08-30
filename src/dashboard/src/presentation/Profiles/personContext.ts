import { useOutletContext } from 'react-router'
import type { Profile } from '../../domain/entities/Profile'

export interface PersonContext {
  person: Profile
  /** A page can rename the person: the shell has to notice. */
  reload: () => void
}

export function usePerson(): PersonContext {
  return useOutletContext<PersonContext>()
}
