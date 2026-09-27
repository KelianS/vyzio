import type { SupportedProtocol } from './camera_capability_binding.entity'

/** Where a protocol stands after its check: reached, then logged in with its account (ADR-61). */
export const ProtocolStatus = {
  Answers: 'answers',
  /** Reached, but the account or the device number was turned down. */
  Refused: 'refused',
  Unreachable: 'unreachable',
} as const

export type ProtocolStatus = (typeof ProtocolStatus)[keyof typeof ProtocolStatus]

/** A protocol the camera speaks: how it is reached, and whether it answers with its account (ADR-61). */
export interface CameraProtocol {
  protocol: SupportedProtocol
  /** The port set by hand; null means the protocol's usual one. */
  port: number | null
  /** The port Vyzio dials; null for ONVIF until the camera said where it answers. */
  effectivePort: number | null
  /** The protocol's own account, overriding the camera's; its password never leaves the server. */
  username: string | null
  hasOwnAccount: boolean
  /** The number V380 addresses the camera by. */
  deviceId: number | null
  /** Null until the camera was asked. */
  status: ProtocolStatus | null
  checkedAt: string | null
  lastError: string | null
}

/** What the screen sends back for one protocol: a null password keeps the saved one. */
export interface CameraProtocolInput {
  port: number | null
  username: string | null
  password: string | null
  deviceId: number | null
}
