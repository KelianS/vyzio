export interface PersonIdentityUido {
  saving: boolean
  confirmDelete: boolean
  deleting: boolean
}

export function buildInitialPersonIdentityUido(): PersonIdentityUido {
  return { saving: false, confirmDelete: false, deleting: false }
}
