import { CameraState, type Camera, type PrivacyResume } from '../../domain/entities/camera.entity'
import { WEEK_DAYS } from '../../common/schedule/schedule_types'
import type { Capability } from '../../domain/entities/camera_capability_binding.entity'

/** Plain names, the words the rest of the product uses for each capability (DESIGN SYSTEM § Shared words). */
export const CAPABILITY_LABELS: Record<Capability, string> = {
  stream: 'Flux vidéo',
  ptz: 'Orientation',
  hardware_privacy: 'Coupure matérielle',
  image_settings: 'Réglages image',
}

/** The video stream, the capability every other one depends on. */
export const STREAM_LABEL = CAPABILITY_LABELS.stream

/** The way out of a stream that does not answer, wherever it is said: both places it can be fixed (SPECS 2.3). */
export const STREAM_REPAIR =
  'vérifiez l’adresse et le compte de la caméra dans Avancé, puis les options du flux vidéo.'

/** A removal button drawn in outline, so it reads as destructive without shouting. */
export const DESTRUCTIVE_OUTLINE = 'border-destructive text-destructive hover:bg-destructive/10'

/** Why a capability test cannot run, next to every button it greys out (SPECS 2.2). */
export const TESTS_SUSPENDED =
  'Les autres capacités se vérifient une fois que le flux vidéo fonctionne.'

const IMAGE_DOES_NOT_ARRIVE =
  'La caméra répond, mais son image n’arrive pas : vérifiez le compte de la caméra dans Avancé, puis les options du flux vidéo.'

// Why the stream's check failed, by what the camera answers now; config_error is the camera's, not the stream's (SPECS 1.5).
const STREAM_FAILURE_LINES: Record<string, string> = {
  [CameraState.Offline]: `Vyzio ne reçoit pas les images : ${STREAM_REPAIR}`,
  [CameraState.Degraded]: IMAGE_DOES_NOT_ARRIVE,
  [CameraState.Online]: IMAGE_DOES_NOT_ARRIVE,
}

/** The state line of a failed stream check; a status that says nothing more reads as a plain failed check. */
export function formatStreamFailureLine(camera: Camera): string {
  return (
    STREAM_FAILURE_LINES[camera.status] ?? `La dernière vérification a échoué : ${STREAM_REPAIR}`
  )
}

/** The state line of a working stream: the last image seen, else its last check. */
export function formatStreamWorkingLine(camera: Camera, verifiedAt: string | null): string | null {
  if (camera.lastSuccessfulFrameAt)
    return `Dernière image confirmée le ${formatCheckedAt(camera.lastSuccessfulFrameAt)}`
  return verifiedAt ? `Vérifié le ${formatCheckedAt(verifiedAt)}` : null
}

/** The state line of a stream nobody checked since its connection changed. */
export const STREAM_UNCHECKED = 'Lancez « Vérifier » pour confirmer que Vyzio reçoit les images.'

export function formatCheckedAt(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** One read, one sentence: the saved positions, wherever their read fails. */
export const POSITIONS_UNREAD = 'Les positions de cette caméra n’ont pas pu être lues.'

/** Until when a surveillance resumed inside a range holds, in the house's clock (SPECS 9.2). */
export function formatPrivacyResume({ until }: PrivacyResume): string {
  const day = WEEK_DAYS.find((d) => d.value === until?.dayOfWeek)
  if (!until || !day) return 'Surveillance reprise malgré les plages en cours.'
  return `Surveillance reprise jusqu’à la fin de la plage, ${day.name.toLocaleLowerCase('fr')} à ${until.time}, heure de la maison.`
}
