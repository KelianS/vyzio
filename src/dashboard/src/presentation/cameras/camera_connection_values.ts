import type { Camera } from '../../domain/entities/camera.entity'
import type {
  CameraCapabilityBinding,
  SupportedProtocol,
} from '../../domain/entities/camera_capability_binding.entity'
import type {
  CameraProtocol,
  CameraProtocolInput,
} from '../../domain/entities/camera_protocol.entity'

/** One protocol box as the draft holds it (ADR-61). */
export interface ProtocolValues {
  /** The port shown and edited: the one Vyzio dials. */
  port: number | null
  /** What the box showed when read, and the port set by hand then: an untouched port sends back only the latter. */
  shownPort: number | null
  handPort: number | null
  ownAccount: boolean
  username: string
  password: string
  deviceId: string
}

export type ProtocolKey = `protocol:${SupportedProtocol}`

/** The Connexion page's draft: the camera's identity and access, the stream's path, one box per protocol. */
export type ConnectionValues = {
  displayName: string
  host: string
  username: string
  password: string
  streamPath: string
} & Record<ProtocolKey, ProtocolValues>

export const ALL_PROTOCOLS: readonly SupportedProtocol[] = [
  'rtsp',
  'onvif',
  'dvrip',
  'v380',
  'tapo_klap',
]

export function protocolKey(protocol: SupportedProtocol): ProtocolKey {
  return `protocol:${protocol}`
}

const EMPTY_BOX: ProtocolValues = {
  port: null,
  shownPort: null,
  handPort: null,
  ownAccount: false,
  username: '',
  password: '',
  deviceId: '',
}

function boxOf(entry: CameraProtocol | undefined): ProtocolValues {
  if (!entry) return EMPTY_BOX
  return {
    port: entry.effectivePort,
    shownPort: entry.effectivePort,
    handPort: entry.port,
    ownAccount: entry.hasOwnAccount,
    username: entry.username ?? '',
    password: '',
    deviceId: entry.deviceId === null ? '' : String(entry.deviceId),
  }
}

/** The saved values the draft starts from; a protocol the camera does not speak keeps an empty box. */
export function connectionValuesOf(
  camera: Camera,
  stream: CameraCapabilityBinding | undefined,
  protocols: CameraProtocol[],
): ConnectionValues {
  const boxes = Object.fromEntries(
    ALL_PROTOCOLS.map((protocol) => [
      protocolKey(protocol),
      boxOf(protocols.find((entry) => entry.protocol === protocol)),
    ]),
  ) as Record<ProtocolKey, ProtocolValues>

  return {
    displayName: camera.displayName,
    host: camera.host,
    username: camera.username ?? '',
    password: '',
    streamPath: stream?.streamPath ?? '',
    ...boxes,
  }
}

/** What a box sends: its own account only while it is switched on, an empty password keeping the saved one. */
export function protocolInputOf(box: ProtocolValues): CameraProtocolInput {
  const deviceId = Number.parseInt(box.deviceId, 10)
  return {
    // An ONVIF port found by asking the camera is not one the user set: sent back, it would pin the search.
    port: box.port === box.shownPort ? box.handPort : box.port,
    username: box.ownAccount ? box.username.trim() || null : null,
    password: box.ownAccount && box.password ? box.password : null,
    deviceId: Number.isNaN(deviceId) ? null : deviceId,
  }
}

/** Back to its saved content, a box is no longer a change: the draft compares by reference. */
export function sameBox(left: ProtocolValues, right: ProtocolValues): boolean {
  return (
    left.port === right.port &&
    left.ownAccount === right.ownAccount &&
    left.username === right.username &&
    left.password === right.password &&
    left.deviceId === right.deviceId
  )
}
