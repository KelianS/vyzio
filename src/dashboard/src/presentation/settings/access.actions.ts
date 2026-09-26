export type AccessAction =
  | { type: 'MIN_LENGTH_LOADED'; minLength: number }
  | { type: 'CHANGE_STARTED' }
  | { type: 'CHANGE_REFUSED' }
  | { type: 'CHANGE_FINISHED' }
  | { type: 'EVERYWHERE_ASKED' }
  | { type: 'EVERYWHERE_CLOSED' }
  | { type: 'LEAVE_STARTED' }
  | { type: 'LEAVE_FINISHED' }
  | { type: 'LEAVE_EVERYWHERE_STARTED' }
  | { type: 'LEAVE_EVERYWHERE_FINISHED' }
