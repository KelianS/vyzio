export interface AccessUido {
  /** Read from the server, the one home of the rule; null until it answers. */
  minLength: number | null
  changing: boolean
  refused: boolean
  confirmEverywhere: boolean
  leaving: boolean
  leavingEverywhere: boolean
}

export function buildInitialAccessUido(): AccessUido {
  return {
    minLength: null,
    changing: false,
    refused: false,
    confirmEverywhere: false,
    leaving: false,
    leavingEverywhere: false,
  }
}
