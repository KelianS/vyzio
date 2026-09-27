import type { BadgeTone } from '../../common/components/badge'
import type {
  CameraCapabilityBinding,
  Capability,
} from '../../domain/entities/camera_capability_binding.entity'
import { ProtocolStatus } from '../../domain/entities/camera_protocol.entity'

/** Where a capability stands, the pill of its card (DESIGN SYSTEM § Capability cards). */
export const CapabilityState = {
  Working: 'working',
  Failed: 'failed',
  Unconfigured: 'unconfigured',
  SwitchedOff: 'switched_off',
} as const
export type CapabilityState = (typeof CapabilityState)[keyof typeof CapabilityState]

// Orientation is switched on and off and never removed; the other capabilities are removed instead.
export const SWITCHED_ON_AND_OFF: Record<Capability, boolean> = {
  stream: false,
  ptz: true,
  hardware_privacy: false,
  image_settings: false,
}

export const CAPABILITY_STATE_PILLS: Record<CapabilityState, { label: string; tone: BadgeTone }> = {
  working: { label: 'Fonctionne', tone: 'ok' },
  failed: { label: 'En échec', tone: 'danger' },
  unconfigured: { label: 'À configurer', tone: 'neutral' },
  switched_off: { label: 'Désactivée', tone: 'neutral' },
}

/** A switch the user turned off wins over the last test: the capability is not in use, whatever it answered. */
export function capabilityState(
  binding: CameraCapabilityBinding,
  switchedOn: boolean,
): CapabilityState {
  if (!binding.isConfigured) return CapabilityState.Unconfigured
  if (SWITCHED_ON_AND_OFF[binding.capability] && !switchedOn) return CapabilityState.SwitchedOff
  return binding.verified ? CapabilityState.Working : CapabilityState.Failed
}

// The stream is a capability like the others, first among them and drawn on its own card.
export const IS_STREAM: Record<Capability, boolean> = {
  stream: true,
  ptz: false,
  hardware_privacy: false,
  image_settings: false,
}

export function streamBindingOf(
  bindings: CameraCapabilityBinding[],
): CameraCapabilityBinding | undefined {
  return bindings.find((b) => IS_STREAM[b.capability])
}

/** A protocol box's pill: its last check, reach then login with its account (ADR-61). */
const PROTOCOL_STATE_PILLS: Record<ProtocolStatus, { label: string; tone: BadgeTone }> = {
  answers: { label: 'Répond', tone: 'ok' },
  refused: { label: 'Refuse l’accès', tone: 'danger' },
  unreachable: { label: 'Ne répond pas', tone: 'danger' },
}

export const UNCHECKED_PILL: { label: string; tone: BadgeTone } = {
  label: 'Pas encore vérifié',
  tone: 'neutral',
}

export function protocolPill(status: ProtocolStatus | null): { label: string; tone: BadgeTone } {
  return status === null ? UNCHECKED_PILL : PROTOCOL_STATE_PILLS[status]
}

// The way out of a failed capability depends on what its protocol said: wake it, fix the account, or try again.
const FAILURE_LINES: Record<ProtocolStatus, string> = {
  unreachable:
    'La caméra ne répond pas par ce moyen : vérifiez qu’elle est allumée, ou réveillez-la si elle est sur batterie, puis relancez.',
  refused:
    'La caméra refuse le compte pour ce moyen : vérifiez le compte de la caméra, ou le compte spécifique de ce moyen, dans Avancé, puis relancez.',
  answers:
    'La dernière vérification a échoué : relancez-la, ou choisissez une autre façon de la joindre dans ses options.',
}

/** The plain sentence of a failed capability card (SPECS 1.5); a protocol not checked yet reads as a plain failure. */
export function capabilityFailureLine(status: ProtocolStatus | null): string {
  return FAILURE_LINES[status ?? ProtocolStatus.Answers]
}

// The stream card keeps its own sentence unless its protocol said why, then speaks the cards' plain words.
const STREAM_PROTOCOL_LINES: Record<ProtocolStatus, string | null> = {
  unreachable: FAILURE_LINES.unreachable,
  refused: FAILURE_LINES.refused,
  answers: null,
}

/** The plain sentence of a stream whose protocol failed; null when its own state line says it better. */
export function streamProtocolFailureLine(status: ProtocolStatus | null): string | null {
  return status === null ? null : STREAM_PROTOCOL_LINES[status]
}

// What the protocol itself says went wrong, above its diagnostic line; nothing when it answers.
const PROTOCOL_FAILURE_LINES: Record<ProtocolStatus, string | null> = {
  unreachable:
    'La caméra ne répond pas sur ce port : vérifiez qu’elle est allumée et que ce protocole est activé sur elle.',
  refused:
    'La caméra refuse le compte : vérifiez celui de la caméra, ou le compte spécifique de ce protocole.',
  answers: null,
}

/** The plain sentence of a protocol box that failed; null otherwise. */
export function protocolFailureLine(status: ProtocolStatus | null): string | null {
  return status === null ? null : PROTOCOL_FAILURE_LINES[status]
}
