/** What a camera is, and how it is reached: its identity and account (ADR-04). */
export interface CameraUpdateInput {
  displayName: string
  host: string
  username: string | null
  password: string | null
  sourceType: string
  ptzSupported?: boolean | null
}

/** A camera to add: its access alone, its page's detection finds the rest (ADR-04). */
export type NewCameraInput = Pick<
  CameraUpdateInput,
  'displayName' | 'host' | 'username' | 'password'
>
