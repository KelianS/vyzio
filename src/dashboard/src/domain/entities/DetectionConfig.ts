// Mirrors the backend MotionSensitivity enum (ADR-35). Ordered from most to least sensitive.
export type MotionSensitivity = 'high' | 'medium' | 'low'

// A video stream of a camera (ADR-38). Streams are ranked, not named: ordinal 0 is the most
// detailed one the camera serves. width/height are null when the protocol reported no exact size —
// the UI must say so rather than show a nominal value that would be wrong.
export interface CameraStream {
  id: string
  ordinal: number
  width: number | null
  height: number | null
  fps: number | null
}

export interface DetectionConfig {
  cameraId: string
  labels: string[]
  availableLabels: string[]
  continuousRecordingEnabled: boolean
  motionSensitivity: MotionSensitivity
  motionSensitivityPinned: boolean
  streams: CameraStream[]
  detectStreamId: string | null
}

// Grouped rather than passed as positional arguments: the call sites toggle one field at a time and
// carry the rest through unchanged, which is exactly where a long positional list gets mis-ordered.
export interface DetectionConfigUpdate {
  labels: string[]
  continuousRecordingEnabled: boolean
  motionSensitivity: MotionSensitivity
  motionSensitivityPinned: boolean
  detectStreamId: string | null
}
