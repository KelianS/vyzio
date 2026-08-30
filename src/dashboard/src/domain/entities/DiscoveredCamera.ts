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
}
