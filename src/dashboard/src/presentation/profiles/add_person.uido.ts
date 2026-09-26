import type { CreateProfileRequest } from '../../domain/ports/profile.port'

export interface AddPersonUido {
  form: CreateProfileRequest
  creating: boolean
}

export function buildInitialAddPersonUido(): AddPersonUido {
  return { form: { name: '', category: 'family', alertMode: 'always' }, creating: false }
}
