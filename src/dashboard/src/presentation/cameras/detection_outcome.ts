import { scrubSecrets } from '../../common/errors/scrub_secrets'
import type { CameraCapabilityBinding } from '../../domain/entities/camera_capability_binding.entity'
import { ProtocolStatus, type CameraProtocol } from '../../domain/entities/camera_protocol.entity'
import { IS_STREAM } from './capability_state'
import { PROTOCOL_LABELS } from './protocol_labels'

/** What a detection found, read from what it left on the camera (SPECS 2.2: the page says what answers). */
export const DetectionOutcome = {
  StreamWorks: 'stream_works',
  StreamNotWorking: 'stream_not_working',
  AccountRefused: 'account_refused',
  NothingAnswers: 'nothing_answers',
} as const

export type DetectionOutcome = (typeof DetectionOutcome)[keyof typeof DetectionOutcome]

/** The result line of a detection: a plain sentence first, then what each protocol answered for support (SPECS 1.5). */
export interface DetectionResult {
  outcome: DetectionOutcome
  diagnostic: string | null
}

export const DETECTION_SENTENCES: Record<DetectionOutcome, string> = {
  [DetectionOutcome.StreamWorks]: 'Détection terminée : le flux vidéo de la caméra fonctionne.',
  [DetectionOutcome.StreamNotWorking]:
    'La caméra répond, mais son flux vidéo ne fonctionne pas encore : voir les options du flux vidéo.',
  [DetectionOutcome.AccountRefused]:
    'La caméra répond, mais refuse le compte : vérifiez l’identifiant et le mot de passe dans Avancé.',
  [DetectionOutcome.NothingAnswers]:
    'Rien ne répond à cette adresse : la caméra est peut-être éteinte, endormie, ou à une autre adresse. Vérifiez-la dans Avancé, puis relancez « Détecter automatiquement ».',
}

export function detectionResultOf(
  host: string,
  bindings: readonly CameraCapabilityBinding[],
  protocols: readonly CameraProtocol[],
): DetectionResult {
  const stream = bindings.find((binding) => IS_STREAM[binding.capability])
  const answering = protocols.some((p) => p.status === ProtocolStatus.Answers)
  const refused = protocols.some((p) => p.status === ProtocolStatus.Refused)
  const outcome =
    stream?.isConfigured && stream.verified
      ? DetectionOutcome.StreamWorks
      : answering
        ? DetectionOutcome.StreamNotWorking
        : refused
          ? DetectionOutcome.AccountRefused
          : DetectionOutcome.NothingAnswers
  const errors = protocols
    .filter((p) => p.lastError)
    .map((p) => `${PROTOCOL_LABELS[p.protocol]} : ${scrubSecrets(p.lastError ?? '')}`)
  // A silent try leaves no protocol behind: the photo for support still says what was asked (SPECS 1.5).
  const asked = errors.length > 0 ? errors.join(' · ') : `${host} : aucun protocole n’a répondu`
  return { outcome, diagnostic: outcome === DetectionOutcome.StreamWorks ? null : asked }
}
