import type { AppError } from '../../common/errors/app_error'
import type { StreamProtocol } from '../../domain/entities/camera_capability_binding.entity'
import type {
  DiscoveredCamera,
  DiscoveryRange,
} from '../../domain/entities/discovered_camera.entity'

/** What's being added: a discovered camera, or a manually typed address (ADR-40). */
type AddCameraSelection =
  /** Nothing chosen yet. */
  { kind: 'none' } | { kind: 'manual' } | { kind: 'candidate'; index: number }

/** The add form as the user fills it, flat; the stream fields become the camera's stream capability (ADR-61). */
export interface AddCameraForm {
  displayName: string
  host: string
  port: number
  username: string | null
  password: string | null
  streamPath: string | null
  vendorFamily?: string | null
  sourceType: string
  streamProtocol: StreamProtocol
}

export const emptyCameraDraft: AddCameraForm = {
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
  form: AddCameraForm

  discoveryResults: DiscoveredCamera[]
  /** The ranges the last search went through, shown so the user knows where it looked (#251). */
  sweptRanges: DiscoveryRange[]
  discovering: boolean
  refreshing: boolean
  verifying: boolean
  creating: boolean

  /** Last draft-verification result; any edit invalidates it. */
  verification: { connected: boolean; guidance: string | null } | null

  message: string | null
  /** A failure: its sentence, and the diagnostic line when a call failed (SPECS 1.5). */
  error: { message: string; diagnostic?: string } | null
  confirmScan: boolean

  /** The vendor's notice for the brand being added, when it has one. */
  vendorAssistance: { loading: boolean; markdown: string | null; error: AppError | null }
}

export function buildInitialAddCameraUido(): AddCameraUido {
  return {
    selection: { kind: 'none' },
    form: emptyCameraDraft,

    discoveryResults: [],
    sweptRanges: [],
    discovering: false,
    refreshing: false,
    verifying: false,
    creating: false,

    verification: null,

    message: null,
    error: null,
    confirmScan: false,

    vendorAssistance: { loading: false, markdown: null, error: null },
  }
}
