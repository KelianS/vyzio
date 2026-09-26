import type { DetectionEvent } from '../domain/entities/detection_event.entity'

/** A detection as the API sends it, for tests; each test overrides only what it is about. */
export function makeDetectionEvent(overrides: Partial<DetectionEvent> = {}): DetectionEvent {
  return {
    eventId: 'event-1',
    camera: 'front_door',
    cameraName: 'Front Door',
    label: 'person',
    identity: null,
    profileId: null,
    confidence: 0.9,
    occurredAt: '2026-09-26T08:00:00Z',
    hasClip: false,
    hasSnapshot: false,
    mediaExpired: false,
    ...overrides,
  }
}
