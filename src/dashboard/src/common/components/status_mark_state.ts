/** The three marks of UI-31: running or working, neither, offline or failing. */
export const StatusMarkKind = {
  On: 'on',
  Off: 'off',
  Alert: 'alert',
} as const

export type StatusMarkKind = (typeof StatusMarkKind)[keyof typeof StatusMarkKind]

/** What a mark says: its shape and colour, and the word it carries as its accessible name. */
export interface StatusMarkState {
  kind: StatusMarkKind
  label: string
}

/** A nominal state is not written in words: only an exception carries its word as a subtitle (UI-31). */
export function markSubtitle({ kind, label }: StatusMarkState): string | null {
  return kind === StatusMarkKind.On ? null : label
}
