export type PersonIdentityAction =
  | { type: 'SAVE_STARTED' }
  | { type: 'SAVE_FINISHED' }
  | { type: 'DELETE_ASKED' }
  | { type: 'DELETE_CANCELLED' }
  | { type: 'DELETE_STARTED' }
  | { type: 'DELETE_FINISHED' }
