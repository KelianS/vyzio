import type { StreamProtocol } from './camera_capability_binding.entity'

/** What a camera is, and how it is reached: its identity and account (ADR-61). */
export interface CameraUpdateInput {
  displayName: string
  host: string
  username: string | null
  password: string | null
  vendorFamily?: string | null
  sourceType: string
  ptzSupported?: boolean | null
}

/** A camera to add, born with its stream: the protocol, its port (null: the usual one) and the path over RTSP. */
export interface CameraDraftInput extends Omit<CameraUpdateInput, 'ptzSupported'> {
  stream: { protocol: StreamProtocol; port: number | null; path: string | null }
}
