import type { AppError } from '../../common/errors/AppError'
import type { CameraDraftInput } from '../../domain/entities/CameraDraftInput'
import type { DetectionLabel } from '../../domain/entities/DetectionLabel'
import type { DiscoveredCamera } from '../../domain/entities/DiscoveredCamera'

export type CameraSelection =
  | { kind: 'manual' }
  | { kind: 'candidate'; index: number }
  | { kind: 'camera'; cameraId: string }

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
  detectionContinuousRecording: boolean
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
    detectionContinuousRecording: false,
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
