// Installation-wide retention (ADR-39). Three durations in days; zero means "keep nothing of this
// kind", which is a real answer rather than an absent value.
export interface RecordingSettings {
  continuousDays: number
  motionDays: number
  eventClipDays: number
  maxDays: number
}

export type RecordingSettingsUpdate = Omit<RecordingSettings, 'maxDays'>
