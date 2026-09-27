import type { DetectionConfig } from '../domain/entities/detection_config.entity'

/** A camera's detection settings as the API sends them, for tests; each test overrides only what it is about. */
export function makeDetectionConfig(overrides: Partial<DetectionConfig> = {}): DetectionConfig {
  return {
    cameraId: 'camera-1',
    labels: ['person'],
    availableLabels: [],
    retention: {
      continuous: { override: null, installation: 0, effective: 0 },
      motion: { override: null, installation: 7, effective: 7 },
      eventClip: { override: 30, installation: 14, effective: 30 },
      maxDays: 365,
      minEventClipDays: 1,
    },
    motionSensitivity: 'medium',
    motionSensitivityPinned: false,
    ...overrides,
  }
}
