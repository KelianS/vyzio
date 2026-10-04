import type { BadgeTone } from '../../common/components/badge'
import type { SettingOption } from '../../common/settings/setting_declaration'
import type { SupportedProtocol } from '../../domain/entities/camera_capability_binding.entity'
import {
  StreamRole,
  type CameraStream,
  type CameraStreamLineup,
} from '../../domain/entities/camera_stream.entity'
import { CAPABILITY_STATE_PILLS, UNCHECKED_PILL } from './capability_state'
import { PROTOCOL_LABELS } from './protocol_labels'

/** Where a stream line stands, its pill (DESIGN SYSTEM § Capability cards, stream lines). */
export const StreamLineState = {
  Working: 'working',
  Failed: 'failed',
  Unchecked: 'unchecked',
  Disabled: 'disabled',
} as const
export type StreamLineState = (typeof StreamLineState)[keyof typeof StreamLineState]

export const STREAM_LINE_PILLS: Record<StreamLineState, { label: string; tone: BadgeTone }> = {
  working: CAPABILITY_STATE_PILLS.working,
  failed: CAPABILITY_STATE_PILLS.failed,
  unchecked: UNCHECKED_PILL,
  disabled: { label: 'Désactivé', tone: 'neutral' },
}

/** A switch the user turned off wins over the last check: the stream is not in use. */
export function streamLineState(stream: CameraStream): StreamLineState {
  if (!stream.enabled) return StreamLineState.Disabled
  if (stream.checkedAt === null) return StreamLineState.Unchecked
  return stream.verified ? StreamLineState.Working : StreamLineState.Failed
}

// Only an RTSP stream is addressed by a path; DVRIP derives it from the protocol (ADR-61).
export const ASKS_STREAM_PATH: Record<SupportedProtocol, boolean> = {
  rtsp: true,
  dvrip: false,
  onvif: false,
  v380: false,
  tapo_klap: false,
}

export const ROLE_LABELS: Record<StreamRole, string> = {
  none: 'Aucun',
  record: 'Enregistrement',
  detect: 'Détection',
  record_and_detect: 'Enregistrement et détection',
}

// What each role changes, the role's tooltip (ADR-53, two sentences at most); the analysed image also feeds the thumbnail and notifications.
export const ROLE_CONSEQUENCES: Record<StreamRole, string> = {
  none: 'Ce flux reste prêt, sans servir.',
  record: 'Vos enregistrements sont faits sur ce flux : plus il est détaillé, plus ils sont nets.',
  detect:
    'Vyzio analyse ce flux et en tire la vignette et les images des notifications. Plus léger, il soulage le boîtier ; plus détaillé, il reconnaît mieux les visages éloignés.',
  record_and_detect:
    'Ce flux sert aux enregistrements et à l’analyse, donc aussi à la vignette et aux images des notifications.',
}

export const RECORDING_STREAM_KEPT =
  'Ce flux enregistre : confiez l’enregistrement à un autre flux avant de le désactiver ou de le retirer.'

/** A failed line's way out; the recording stream's failure is the camera's, whose card already names it. */
export function streamFailure(records: boolean): string {
  return records
    ? 'Ce flux ne répond pas.'
    : 'Ce flux ne répond pas : relancez sa vérification, ou retirez-le.'
}

// Said in the confirmation that takes the detection stream away: the analysis falls back (ADR-65 c).
export const DETECTION_FALLS_BACK = 'La détection passera par le flux d’enregistrement.'

/** How Vyzio reaches a stream, its quality's tooltip; a path shown as its own setting is not repeated. */
export function streamReach(stream: CameraStream, pathShown: boolean): string {
  const protocol = PROTOCOL_LABELS[stream.protocol]
  return ASKS_STREAM_PATH[stream.protocol] && stream.path && !pathShown
    ? `Par ${protocol}, chemin ${stream.path}.`
    : `Par ${protocol}.`
}

const ALL_ROLES: readonly StreamRole[] = [
  StreamRole.Record,
  StreamRole.Detect,
  StreamRole.RecordAndDetect,
  StreamRole.None,
]
const RECORDING_ROLES: readonly StreamRole[] = [StreamRole.Record, StreamRole.RecordAndDetect]

/** The recording stream is offered only the roles that record: one enabled stream always records (ADR-65 b). */
export function roleOptions(stream: CameraStream, lineup: CameraStreamLineup): SettingOption[] {
  const roles = stream.id === lineup.recordStreamId ? RECORDING_ROLES : ALL_ROLES
  return roles.map((role) => ({ value: role, label: ROLE_LABELS[role] }))
}

/** A stream is described by what the camera reports; its rank is only the fallback (ADR-38). */
export function streamQuality(stream: CameraStream): string {
  const size =
    stream.width !== null && stream.height !== null
      ? `${stream.width} × ${stream.height}`
      : stream.ordinal === 0
        ? 'Flux principal'
        : `Flux secondaire ${stream.ordinal}`
  return stream.fps !== null ? `${size} · ${stream.fps} img/s` : size
}

/** The card's one extra sentence when detection is not covered as chosen; null when it is (ADR-65 c). */
export function streamCoverageLine(lineup: CameraStreamLineup | null): string | null {
  if (lineup === null) return null
  const detect = lineup.streams.find((stream) => stream.id === lineup.detectStreamId)
  const detectFails =
    detect !== undefined &&
    detect.id !== lineup.recordStreamId &&
    streamLineState(detect) === StreamLineState.Failed
  if (detectFails)
    return 'La détection est interrompue : son flux ne répond pas. Donnez-la à un autre flux dans les options.'
  if (lineup.detectsOnRecordingStream) return 'La détection passe par le flux d’enregistrement.'
  return null
}

/** A stream added by hand takes the next rank (StreamLineup.Add), so it is the lineup's highest. */
export function addedStream(lineup: CameraStreamLineup): CameraStream | undefined {
  return lineup.streams.reduce<CameraStream | undefined>(
    (highest, stream) =>
      highest === undefined || stream.ordinal > highest.ordinal ? stream : highest,
    undefined,
  )
}

/** Over DVRIP a stream is picked by its quality, the convention of ADR-38, never a typed query. */
export const DVRIP_QUALITIES: readonly { value: string; label: string; secondary: boolean }[] = [
  { value: 'main', label: 'Flux principal', secondary: false },
  { value: 'sub', label: 'Flux secondaire', secondary: true },
]
