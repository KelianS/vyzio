import type { AppError } from '../../common/errors/AppError'
import type { CameraDraftInput } from '../../domain/entities/CameraDraftInput'
import type {
  CameraRetention,
  CameraStream,
  MotionSensitivity,
} from '../../domain/entities/DetectionConfig'
import type { DetectionLabel } from '../../domain/entities/DetectionLabel'
import type { DiscoveredCamera } from '../../domain/entities/DiscoveredCamera'

export type CameraSelection =
  | { kind: 'manual' }
  | { kind: 'candidate'; index: number }
  | { kind: 'camera'; cameraId: string }
// Settings that belong to the installation rather than to any one camera (ADR-39).

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

// Placeholder until the camera's real retention arrives: no overrides, and zero days everywhere so
// nothing claims to be kept before the server has said what is.
const NOTHING_KEPT = { override: null, installation: 0, effective: 0 }

export const emptyCameraRetention: CameraRetention = {
  continuous: NOTHING_KEPT,
  motion: NOTHING_KEPT,
  eventClip: NOTHING_KEPT,
  maxDays: 365,
}

export interface CamerasUido {
  selection: CameraSelection
  form: CameraDraftInput
  editForm: CameraDraftInput
  editPassword: string
  dvripMode: boolean

  discoveryResults: DiscoveredCamera[]
  discoveryError: string | null
  discoverLoading: boolean

  draftVerification: { connected: boolean; guidance: string | null } | null
  createLoading: boolean
  verifyDraftLoading: boolean
  verifyLoading: boolean
  refreshLoading: boolean
  deleteLoading: boolean
  updateLoading: boolean
  applyLoading: boolean

  formMessage: string | null
  formError: string | null
  detailMessage: string | null
  detailError: string | null

  detectionLabels: string[]
  detectionAvailableLabels: string[]
  allDetectionLabels: DetectionLabel[]
  detectionRetention: CameraRetention
  detectionMotionSensitivity: MotionSensitivity
  detectionMotionSensitivityPinned: boolean
  detectionStreams: CameraStream[]
  detectionStreamId: string | null
  detectionConfigLoading: boolean

  pendingStrategy: string | null
  strategyFeedback: string | null
  saveStrategyLoading: boolean

  confirmDelete: boolean
  confirmScan: boolean
  confirmApply: boolean

  toastError: AppError | null
}

export function buildInitialCamerasUido(): CamerasUido {
  return {
    selection: { kind: 'manual' },
    form: emptyCameraDraft,
    editForm: emptyCameraDraft,
    editPassword: '',
    dvripMode: false,

    discoveryResults: [],
    discoveryError: null,
    discoverLoading: false,

    draftVerification: null,
    createLoading: false,
    verifyDraftLoading: false,
    verifyLoading: false,
    refreshLoading: false,
    deleteLoading: false,
    updateLoading: false,
    applyLoading: false,

    formMessage: null,
    formError: null,
    detailMessage: null,
    detailError: null,

    detectionLabels: ['person'],
    detectionAvailableLabels: [],
    allDetectionLabels: [],
    detectionRetention: emptyCameraRetention,
    detectionMotionSensitivity: 'high',
    detectionMotionSensitivityPinned: false,
    detectionStreams: [],
    detectionStreamId: null,
    detectionConfigLoading: false,

    pendingStrategy: null,
    strategyFeedback: null,
    saveStrategyLoading: false,

    confirmDelete: false,
    confirmScan: false,
    confirmApply: false,

    toastError: null,
  }
}
