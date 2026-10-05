/** Why the live view does not play the video, each read with its own sentence (ADR-72 e). */
export type LiveFailure =
  'unsupported_browser' | 'unsupported_codec' | 'unreachable' | 'privacy' | 'removed' | 'no_quality'

/** Where the live video stands; an interrupted stream played before, and is opened again. */
export type LivePlayback =
  | { kind: 'connecting' }
  | { kind: 'playing'; hasAudio: boolean }
  | { kind: 'interrupted' }
  | { kind: 'failed'; failure: LiveFailure; diagnostic: string }
