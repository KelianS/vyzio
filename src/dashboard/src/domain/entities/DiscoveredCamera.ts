export interface VendorDocumentation {
  vendorFamily: string
  markdown: string
}

export interface DiscoveryTechnicalDetails {
  resolvedHostName: string | null
  httpPortsDetected: number[]
  rtspPortsDetected: number[]
  onvifPortsDetected: number[]
  rtspPathsDetected: string[]
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
