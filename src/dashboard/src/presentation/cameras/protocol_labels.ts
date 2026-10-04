import type {
  Capability,
  SupportedProtocol,
} from '../../domain/entities/camera_capability_binding.entity'
import type { CameraProtocol } from '../../domain/entities/camera_protocol.entity'

/** A protocol's one displayed name, wherever it appears: box, choice list, sentence (SPECS 1.5). */
export const PROTOCOL_LABELS: Record<SupportedProtocol, string> = {
  onvif: 'ONVIF',
  dvrip: 'DVRIP',
  tapo_klap: 'Tapo KLAP',
  v380: 'V380 natif',
  rtsp: 'RTSP',
}

/** Only an RTSP stream is addressed by a path (ADR-61 b). */
export const ASKS_STREAM_PATH: Record<SupportedProtocol, boolean> = {
  rtsp: true,
  dvrip: false,
  onvif: false,
  v380: false,
  tapo_klap: false,
}

/** Why a protocol may take another account, wherever one is entered: it never leaves the local network. */
export const SPECIFIC_ACCOUNT_HELP =
  'Pour une caméra qui demande un autre compte par ce seul moyen, comme le compte cloud Tapo pour la coupure matérielle. Il n’est présenté qu’à la caméra, sur votre réseau.'

/** The two ways to a protocol the camera lacks, in their order: detection first, adding one by hand second. */
const WAYS_TO_A_PROTOCOL =
  'lancez « Détecter automatiquement », ou ajoutez-en un dans Avancé avec « Ajouter un protocole »'

/** On a card whose capability has no protocol of the camera to go through. */
export const NO_PROTOCOL_YET = `Aucun protocole de cette caméra ne convient encore : ${WAYS_TO_A_PROTOCOL}.`

/** Where a capability is added, when no protocol of the camera can carry one that is left. */
export const NO_PROTOCOL_FOR_ANOTHER_CAPABILITY = `Aucun protocole de cette caméra ne permet d’ajouter une autre capacité : ${WAYS_TO_A_PROTOCOL}.`

/** The protocols that can carry each capability, in the order they are offered. */
const CARRIERS: Record<Capability, readonly SupportedProtocol[]> = {
  stream: ['rtsp', 'dvrip'],
  ptz: ['v380', 'onvif', 'dvrip', 'tapo_klap'],
  hardware_privacy: ['tapo_klap'],
  image_settings: ['onvif', 'dvrip'],
}

/** The protocol a capability falls back on: only the stream has one (ADR-61). */
const DEFAULT_PROTOCOL: Record<Capability, SupportedProtocol | null> = {
  stream: 'rtsp',
  ptz: null,
  hardware_privacy: null,
  image_settings: null,
}

export interface ProtocolOption {
  value: SupportedProtocol
  label: string
}

/** The camera's protocols that can carry the capability, plus the one it goes through (ADR-61 d). */
export function protocolOptions(
  capability: Capability,
  protocols: readonly CameraProtocol[],
  current: SupportedProtocol | null,
): ProtocolOption[] {
  return CARRIERS[capability]
    .filter((p) => p === current || protocols.some((entry) => entry.protocol === p))
    .map((p) => ({
      value: p,
      label:
        p === DEFAULT_PROTOCOL[capability]
          ? `${PROTOCOL_LABELS[p]} (par défaut)`
          : PROTOCOL_LABELS[p],
    }))
}
