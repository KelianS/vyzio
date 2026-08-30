import type { CameraDraftInput } from '../../domain/entities/CameraDraftInput'
import type { DiscoveredCamera } from '../../domain/entities/DiscoveredCamera'

/** What's being added: a discovered camera, or a manually typed address (ADR-40). */
type AddCameraSelection =
  /** Nothing chosen yet. */
  { kind: 'none' } | { kind: 'manual' } | { kind: 'candidate'; index: number }

export const emptyCameraDraft: CameraDraftInput = {
  displayName: '',
  host: '',
  port: 554,
  username: null,
  password: null,
  streamPath: null,
  vendorFamily: null,
  sourceType: 'rtsp_manual',
  streamProtocol: 'rtsp',
}

export interface AddCameraUido {
  selection: AddCameraSelection
  form: CameraDraftInput
  /** Fallback when the standard stream is unreachable (ICSee and similar). */
  dvripMode: boolean

  discoveryResults: DiscoveredCamera[]
  discovering: boolean
  refreshing: boolean
  verifying: boolean
  creating: boolean

  /** Last draft-verification result; any edit invalidates it. */
  verification: { connected: boolean; guidance: string | null } | null

  message: string | null
  error: string | null
  confirmScan: boolean
}

export function buildInitialAddCameraUido(): AddCameraUido {
  return {
    selection: { kind: 'none' },
    form: emptyCameraDraft,
    dvripMode: false,

    discoveryResults: [],
    discovering: false,
    refreshing: false,
    verifying: false,
    creating: false,

    verification: null,

    message: null,
    error: null,
    confirmScan: false,
  }
}
