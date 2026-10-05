import type { StreamProtocol } from './camera_capability_binding.entity'

interface VendorDocumentation {
  vendorFamily: string
  markdown: string
}

interface DetectedPortSignal {
  protocol: string
  label: string
  port: number
}

interface DetectedCapability {
  capability: string
  label: string
  protocolLabels: string[]
}

interface DiscoveryTechnicalDetails {
  resolvedHostName: string | null
  detectedPorts: DetectedPortSignal[]
  rtspPathsDetected: string[]
  capabilities: DetectedCapability[]
}

/** The stream discovery found reachable as is: its protocol, port, and path over RTSP (ADR-61 b). */
interface DiscoveredStream {
  protocol: StreamProtocol
  port: number
  path: string | null
}

/** Where a swept range comes from (#251). */
export const DiscoveryRangeSource = {
  Configured: 'configured',
  DashboardAddress: 'dashboard_address',
} as const

export type DiscoveryRangeSource = (typeof DiscoveryRangeSource)[keyof typeof DiscoveryRangeSource]

/** One address range a discovery swept, from its first to its last address. */
export interface DiscoveryRange {
  cidr: string
  firstAddress: string
  lastAddress: string
  source: DiscoveryRangeSource
}

/** What a discovery returns: the ranges it swept (none for a single address) and what it found. */
export interface DiscoveryResult {
  ranges: DiscoveryRange[]
  candidates: DiscoveredCamera[]
}

export interface DiscoveredCamera {
  displayName: string
  host: string
  port: number
  sourceType: string
  streamPath: string | null
  rtspActive: boolean
  discoverySource: string
  note: string | null
  qualification: string
  vendorFamily: string | null
  qualificationReasons: string[]
  vendorDocumentation?: VendorDocumentation | null
  technicalDetails?: DiscoveryTechnicalDetails | null
  /** Null while no protocol can serve the stream: the camera is still to prepare. */
  stream: DiscoveredStream | null
}
