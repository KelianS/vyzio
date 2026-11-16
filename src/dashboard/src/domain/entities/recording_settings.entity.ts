// One installation-wide retention window (ADR-15): the top level, with nothing above it to follow.
// `default` is the value Vyzio ships with and recommends, the one the interface offers to return to.
interface RetentionSetting {
  days: number
  default: number
}

export interface RecordingSettings {
  continuous: RetentionSetting
  motion: RetentionSetting
  eventClip: RetentionSetting
  maxDays: number
  /** Floor of the duration carrying the history: zero is not an answer there (ADR-12). */
  minEventClipDays: number
}

// The save stays flat — three durations, nothing else to say.
export interface RecordingSettingsUpdate {
  continuousDays: number
  motionDays: number
  eventClipDays: number
}
