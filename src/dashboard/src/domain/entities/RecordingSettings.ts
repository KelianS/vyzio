// One installation-wide retention window (ADR-39). `default` is the value Vyzio ships with, which
// is what lets the interface offer a way back to it and name it.
export interface RetentionSetting {
  days: number
  default: number
}

export interface RecordingSettings {
  continuous: RetentionSetting
  motion: RetentionSetting
  eventClip: RetentionSetting
  maxDays: number
  /** Plancher de la duree qui porte l'historique : le zero n'y est pas une reponse (ADR-48). */
  minEventClipDays: number
}

// The save stays flat — three durations, nothing else to say.
export interface RecordingSettingsUpdate {
  continuousDays: number
  motionDays: number
  eventClipDays: number
}
