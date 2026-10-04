import type { DetectionResult } from './detection_outcome'
import type { AppError } from '../../common/errors/app_error'
import type {
  CameraCapabilityBinding,
  Capability,
  StreamProtocol,
  SupportedProtocol,
} from '../../domain/entities/camera_capability_binding.entity'
import type { CameraProtocol } from '../../domain/entities/camera_protocol.entity'
import type {
  AvailableStream,
  CameraStreamLineup,
} from '../../domain/entities/camera_stream.entity'

/** What a capability card is busy with. */
export const CapabilityTask = {
  Configure: 'configure',
  Verify: 'verify',
  TogglePtz: 'toggle_ptz',
  SetPanInverted: 'set_pan_inverted',
  Remove: 'remove',
  Try: 'try',
  Answer: 'answer',
} as const
export type CapabilityTask = (typeof CapabilityTask)[keyof typeof CapabilityTask]

/** What a stream line is busy with. */
export const StreamTask = {
  Role: 'role',
  Remove: 'remove',
  Check: 'check',
} as const
export type StreamTask = (typeof StreamTask)[keyof typeof StreamTask]

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
  /** Detection ran on this camera since the page opened: a stream it left unchosen says why (ADR-65 e). */
  detected: boolean
  /** What the last detection found, said under its button; null before one finished (SPECS 2.2). */
  detection: DetectionResult | null
  pending: Partial<Record<Capability, CapabilityTask>>
  /** The capabilities tried and waiting for the user's answer (ADR-66). */
  asking: Partial<Record<Capability, true>>
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

  /** Null until read: an unread lineup is not an empty one. */
  streams: CameraStreamLineup | null
  streamsLoading: boolean
  streamsError: AppError | null
  /** The stream lines busy with an action, by stream id. */
  streamTasks: Partial<Record<string, StreamTask>>
  streamFormOpen: boolean
  addingStream: boolean
  /** The camera listed no stream over RTSP: the stream's protocol choice asks for a path (ADR-65 e). */
  streamPathAsked: boolean
  /** What the camera serves, by protocol, asked on demand; absent while it is being asked (ADR-65 e). */
  availableStreams: Partial<Record<StreamProtocol, AvailableStream[]>>
  /** A request for that list that failed: never read as an empty list. */
  availableStreamsErrors: Partial<Record<StreamProtocol, AppError>>
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
    detected: false,
    detection: null,
    pending: {},
    asking: {},
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

    streams: null,
    streamsLoading: true,
    streamsError: null,
    streamTasks: {},
    streamFormOpen: false,
    addingStream: false,
    streamPathAsked: false,
    availableStreams: {},
    availableStreamsErrors: {},
  }
}
