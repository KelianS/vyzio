/** Why the live view does not play the video, each read with its own sentence (ADR-07. */
export type LiveFailure =
  'unsupported_browser' | 'unsupported_codec' | 'unreachable' | 'privacy' | 'removed' | 'no_quality'

/** A failure whose cause may pass, so trying again may succeed (ADR-07. */
export const MAY_PASS: Record<LiveFailure, boolean> = {
  unsupported_browser: false,
  unsupported_codec: false,
  unreachable: true,
  no_quality: false,
  privacy: false,
  removed: false,
}

/** Where the live video stands; an interrupted stream played before, and is opened again. */
export type LivePlayback =
  | { kind: 'connecting' }
  /** soundOffered: a gesture may turn the sound on, the browser playing it and the stream carrying it as far as known. */
  | { kind: 'playing'; soundOffered: boolean }
  | { kind: 'interrupted' }
  /** A stream that played stopped bringing pictures, or closed: the camera no longer answers. */
  | { kind: 'stalled'; diagnostic: string }
  | { kind: 'failed'; failure: LiveFailure; diagnostic: string }
