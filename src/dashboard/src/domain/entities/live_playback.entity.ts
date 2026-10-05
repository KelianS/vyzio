/** Why the live view does not play the video, each read with its own sentence (ADR-72 e). */
export type LiveFailure =
  'unsupported_browser' | 'unsupported_codec' | 'unreachable' | 'privacy' | 'removed' | 'no_quality'

/** Where the live video stands; an interrupted stream played before, and is opened again. */
export type LivePlayback =
  | { kind: 'connecting' }
  /** soundOffered: a gesture may turn the sound on, the browser playing it and the stream carrying it as far as known. */
  | { kind: 'playing'; soundOffered: boolean }
  | { kind: 'interrupted' }
  | { kind: 'failed'; failure: LiveFailure; diagnostic: string }
