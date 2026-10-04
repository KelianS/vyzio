import type { StreamProtocol } from './camera_capability_binding.entity'

/** What a stream serves; exactly one stream records, at most one detects (ADR-65). */
export const StreamRole = {
  None: 'none',
  Record: 'record',
  Detect: 'detect',
  RecordAndDetect: 'record_and_detect',
} as const

export type StreamRole = (typeof StreamRole)[keyof typeof StreamRole]

/** A stream of the camera, a line under its video stream card (ADR-38, ADR-65). */
export interface CameraStream {
  id: string
  /** 0 is the most detailed as enumerated; the interface shows the measured size, never a tier name. */
  ordinal: number
  protocol: StreamProtocol
  path: string | null
  /** Null when the protocol reported no exact size: the interface says so rather than guess. */
  width: number | null
  height: number | null
  fps: number | null
  role: StreamRole
  verified: boolean
  /** Null until the stream was checked. */
  checkedAt: string | null
  lastError: string | null
}

/** Every stream of a camera, with the roles resolved by the server. */
export interface CameraStreamLineup {
  streams: CameraStream[]
  recordStreamId: string | null
  /** The analysed stream: the detect stream, else the recording one. */
  detectStreamId: string | null
  /** No stream holds the detect role: detection runs on the recording stream (ADR-65 c). */
  detectsOnRecordingStream: boolean
}

/** A stream the user adds: its protocol, the path of a stream the camera offered or one typed over RTSP, its role. */
export interface CameraStreamAddition {
  protocol: StreamProtocol
  path: string | null
  role: StreamRole
}

/** A stream the camera serves, asked on demand (ADR-65 e); read by quality, its path only in a tooltip. */
export interface AvailableStream {
  /** 0 is the most detailed the camera listed. */
  rank: number
  path: string | null
  width: number | null
  height: number | null
  fps: number | null
  /** The line it already is, null when it is not listed. */
  streamId: string | null
}
