export interface DetectionEvent {
  eventId: string
  frigateEventId: string
  lifecycle: string
  camera: string
  label: string
  identity: string | null
  profileId: string | null
  confidence: number | null
  occurredAt: string
  hasClip: boolean
  hasSnapshot: boolean
}
