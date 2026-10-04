// Mirrors the backend MotionSensitivity enum (ADR-35). Ordered from most to least sensitive.
export type MotionSensitivity = 'high' | 'medium' | 'low'

// One retention window as this camera sees it (ADR-39). `override` is what the camera decided for
// itself, null meaning "follow the installation"; `installation` is what it falls back to, which is
// what lets a revert name the value it returns to; `effective` is what actually applies, resolved
// server-side so the view never re-derives it.
interface RetentionWindowValue {
  override: number | null
  installation: number
  effective: number
}

export interface CameraRetention {
  continuous: RetentionWindowValue
  motion: RetentionWindowValue
  eventClip: RetentionWindowValue
  maxDays: number
  /** Floor of the duration carrying the history: zero is not an answer there (ADR-48). */
  minEventClipDays: number
}

export interface DetectionConfig {
  cameraId: string
  labels: string[]
  availableLabels: string[]
  retention: CameraRetention
  motionSensitivity: MotionSensitivity
  motionSensitivityPinned: boolean
}

// Grouped rather than passed as positional arguments: the call sites toggle one field at a time and
// carry the rest through unchanged, which is exactly where a long positional list gets mis-ordered.
export interface DetectionConfigUpdate {
  labels: string[]
  motionSensitivity: MotionSensitivity
  motionSensitivityPinned: boolean
  continuousDaysOverride: number | null
  motionDaysOverride: number | null
  eventClipDaysOverride: number | null
}
