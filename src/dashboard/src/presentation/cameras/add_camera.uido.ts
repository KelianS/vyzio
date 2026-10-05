import type { NewCameraInput } from '../../domain/entities/camera_input.entity'
import type { AppError } from '../../common/errors/app_error'
import type {
  DiscoveredCamera,
  DiscoveryRange,
} from '../../domain/entities/discovered_camera.entity'

/** What's being added: a discovered camera, or a manually typed address (ADR-40). */
type AddCameraSelection =
  /** Nothing chosen yet. */
  { kind: 'none' } | { kind: 'manual' } | { kind: 'candidate'; index: number }

/** The add form: the camera's access alone, its page's detection finds the rest (ADR-68 a). */
export type AddCameraForm = NewCameraInput

export const emptyCameraDraft: AddCameraForm = {
  displayName: '',
  host: '',
  username: null,
  password: null,
}

export interface AddCameraUido {
  selection: AddCameraSelection
  form: AddCameraForm

  discoveryResults: DiscoveredCamera[]
  discovering: boolean
  refreshing: boolean
  creating: boolean

  message: string | null
  /** A failure: its sentence, and the diagnostic line when a call failed (SPECS 1.5). */
  error: { message: string; diagnostic?: string } | null
  confirmScan: boolean
  /** The ranges the search will sweep, read when its confirmation opens so it can name them (ADR-71). */
  rangesToSweep: {
    loading: boolean
    ranges: DiscoveryRange[]
    error: { message: string; diagnostic?: string } | null
  }

  /** Which vendor's help sheet shows: discovery's vendor, or the user's pick; never stored nor sent (#274). */
  helpVendor: string | null
  /** The vendor's notice for the brand being added, when it has one. */
  vendorAssistance: { loading: boolean; markdown: string | null; error: AppError | null }
}

export function buildInitialAddCameraUido(): AddCameraUido {
  return {
    selection: { kind: 'none' },
    form: emptyCameraDraft,

    discoveryResults: [],
    discovering: false,
    refreshing: false,
    creating: false,

    message: null,
    error: null,
    confirmScan: false,
    rangesToSweep: { loading: false, ranges: [], error: null },

    helpVendor: null,
    vendorAssistance: { loading: false, markdown: null, error: null },
  }
}
