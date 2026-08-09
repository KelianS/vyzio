export interface DetectionEvent {
  /** Identifiant Frigate : Vyzio n'en tient aucun autre pour une detection (ADR-49). */
  eventId: string
  camera: string
  /** Le nom que l'utilisateur a donne a la camera, resolu a la lecture. */
  cameraName: string
  label: string
  identity: string | null
  profileId: string | null
  confidence: number | null
  occurredAt: string
  hasClip: boolean
  hasSnapshot: boolean
  /** Au-dela de ce que la camera conserve : le media n'existe plus, et c'est un reglage (ADR-48). */
  mediaExpired: boolean
}
