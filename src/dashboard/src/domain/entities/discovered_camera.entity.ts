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

export interface DiscoveredCamera {
  displayName: string
  host: string
  port: number
  sourceType: string
  streamPath: string | null
  rtspActive: boolean
  discoverySource: string
  note: string | null
  macAddress: string | null
  isSupported: boolean
  qualification: string
  supportLevel: string
  vendorFamily: string | null
  qualificationReasons: string[]
  vendorDocumentation?: VendorDocumentation | null
  technicalDetails?: DiscoveryTechnicalDetails | null
  /** Null while no protocol can serve the stream: the camera is still to prepare. */
  stream: DiscoveredStream | null
}
