export interface VendorDocumentation {
  vendorFamily: string
  markdown: string
}

export interface DiscoveredCamera {
  displayName: string
  host: string
  port: number
  sourceType: string
  streamPath: string | null
  discoverySource: string
  note: string | null
  macAddress: string | null
  qualification: string
  supportLevel: string
  vendorFamily: string | null
  qualificationReasons: string[]
  vendorDocumentation?: VendorDocumentation | null
}