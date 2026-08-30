export interface DetectionEvent {
  /** The Frigate id: Vyzio holds no other one for a detection (ADR-49). */
  eventId: string
  camera: string
  /** The name the user gave the camera, resolved on read. */
  cameraName: string
  label: string
  identity: string | null
  profileId: string | null
  confidence: number | null
  occurredAt: string
  hasClip: boolean
  hasSnapshot: boolean
  /** Beyond what the camera keeps: the media no longer exists, and that is a setting (ADR-48). */
  mediaExpired: boolean
}
