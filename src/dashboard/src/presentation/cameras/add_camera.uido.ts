import type { NewCameraInput } from '../../domain/entities/camera_input.entity'
import type { AppError } from '../../common/errors/app_error'
import type { DiscoveredCamera } from '../../domain/entities/discovered_camera.entity'

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

    vendorAssistance: { loading: false, markdown: null, error: null },
  }
}
