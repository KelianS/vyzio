import type {
  DetectionConfig,
  DetectionConfigUpdate,
} from '../../domain/entities/detection_config.entity'

// The save takes the whole config: what a tab does not edit goes back as it was read.
export function detectionConfigUpdate(
  config: DetectionConfig,
  patch: Partial<DetectionConfigUpdate>,
): DetectionConfigUpdate {
  return {
    labels: config.labels,
    motionSensitivity: config.motionSensitivity,
    motionSensitivityPinned: config.motionSensitivityPinned,
    detectStreamId: config.detectStreamId,
    continuousDaysOverride: config.retention.continuous.override,
    motionDaysOverride: config.retention.motion.override,
    eventClipDaysOverride: config.retention.eventClip.override,
    ...patch,
  }
}
