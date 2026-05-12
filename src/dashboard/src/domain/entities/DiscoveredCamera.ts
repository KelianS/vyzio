export interface DiscoveredCamera {
  displayName: string
  host: string
  port: number
  sourceType: string
  streamPath: string | null
  discoverySource: string
  note: string | null
}