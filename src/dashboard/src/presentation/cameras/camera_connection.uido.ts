import type { AppError } from '../../common/errors/app_error'
import type {
  CameraCapabilityBinding,
  Capability,
  SupportedProtocol,
} from '../../domain/entities/camera_capability_binding.entity'
import type { CameraProtocol } from '../../domain/entities/camera_protocol.entity'

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

  protocols: CameraProtocol[]
  protocolsLoading: boolean
  protocolsError: AppError | null
  /** The protocols whose « Vérifier » is running. */
  checking: Partial<Record<SupportedProtocol, true>>
  /** The protocols being removed. */
  removing: Partial<Record<SupportedProtocol, true>>
  /** « Rechercher les protocoles » is running. */
  searchingProtocols: boolean
  protocolFormOpen: boolean
  addingProtocol: boolean
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

    protocols: [],
    protocolsLoading: true,
    protocolsError: null,
    checking: {},
    removing: {},
    searchingProtocols: false,
    protocolFormOpen: false,
    addingProtocol: false,
  }
}
