// Mirrors the backend MotionSensitivity enum (ADR-35). Ordered from most to least sensitive.
export type MotionSensitivity = 'high' | 'medium' | 'low'

export interface DetectionConfig {
  cameraId: string
  labels: string[]
  availableLabels: string[]
  continuousRecordingEnabled: boolean
  motionSensitivity: MotionSensitivity
  motionSensitivityPinned: boolean
}

// Grouped rather than passed as positional arguments: the call sites toggle one field at a time and
// carry the rest through unchanged, which is exactly where a long positional list gets mis-ordered.
export interface DetectionConfigUpdate {
  labels: string[]
  continuousRecordingEnabled: boolean
  motionSensitivity: MotionSensitivity
  motionSensitivityPinned: boolean
}
