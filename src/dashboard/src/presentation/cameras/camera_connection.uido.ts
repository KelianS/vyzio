import type { AppError } from '../../common/errors/app_error'
import type {
  CameraCapabilityBinding,
  Capability,
} from '../../domain/entities/camera_capability_binding.entity'

/** What a capability card is busy with. */
export const CapabilityTask = {
  Configure: 'configure',
  Verify: 'verify',
  TogglePtz: 'toggle_ptz',
  SetPanInverted: 'set_pan_inverted',
  Remove: 'remove',
} as const
export type CapabilityTask = (typeof CapabilityTask)[keyof typeof CapabilityTask]

export interface CameraConnectionUido {
  saving: boolean
  verifying: boolean
  confirmDelete: boolean
  deleting: boolean

  bindings: CameraCapabilityBinding[]
  bindingsLoading: boolean
  bindingsError: AppError | null
  cameraGone: boolean
  detecting: boolean
  pending: Partial<Record<Capability, CapabilityTask>>
  manualFormOpen: boolean
  manualConfiguring: boolean
}

export function buildInitialCameraConnectionUido(): CameraConnectionUido {
  return {
    saving: false,
    verifying: false,
    confirmDelete: false,
    deleting: false,

    bindings: [],
    bindingsLoading: true,
    bindingsError: null,
    cameraGone: false,
    detecting: false,
    pending: {},
    manualFormOpen: false,
    manualConfiguring: false,
  }
}
