export interface CameraDraftInput {
  displayName: string
  host: string
  port: number
  username: string | null
  password: string | null
  streamPath: string | null
  sourceType: string
  detectionPreset: string | null
}