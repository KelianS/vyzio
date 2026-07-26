import type { CamerasAction } from './Cameras.Actions'
import type { CamerasUido } from './Cameras.Uido'

export function camerasReducer(state: CamerasUido, action: CamerasAction): CamerasUido {
  switch (action.type) {
    case 'FORM_UPDATED':
      return {
        ...state,
        form: { ...state.form, ...action.patch },
        draftVerification: null,
        formMessage: null,
        formError: null,
      }

    case 'EDIT_FORM_UPDATED':
      return {
        ...state,
        editForm: { ...state.editForm, ...action.patch },
        detailError: null,
        detailMessage: null,
      }

    case 'EDIT_PASSWORD_CHANGED':
      return { ...state, editPassword: action.value }

    case 'MANUAL_ENTRY_SELECTED':
      return {
        ...state,
        selection: { kind: 'manual' },
        draftVerification: null,
        dvripMode: false,
        form: { ...state.form, ...emptyDraftPatch },
        formMessage: null,
        detailError: null,
      }

    case 'CANDIDATE_SELECTED':
      return {
        ...state,
        selection: { kind: 'candidate', index: action.index },
        draftVerification: null,
        dvripMode: false,
        form: {
          ...state.form,
          displayName: action.candidate.displayName,
          host: action.candidate.host,
          port: action.candidate.port,
          sourceType: action.candidate.sourceType,
          streamPath: action.candidate.streamPath,
          vendorFamily: action.candidate.vendorFamily,
          streamProtocol: 'rtsp',
        },
        formMessage: null,
        formError: null,
      }

    case 'CAMERA_SELECTED':
      return {
        ...state,
        selection: { kind: 'camera', cameraId: action.cameraId },
        draftVerification: null,
        detailError: null,
        detailMessage: null,
      }

    case 'DVRIP_MODE_TOGGLED':
      return {
        ...state,
        dvripMode: action.enabled,
        draftVerification: null,
        formMessage: null,
        formError: null,
        form: action.enabled
          ? { ...state.form, port: 34567, streamPath: null, streamProtocol: 'dvrip' }
          : {
              ...state.form,
              port: action.fallbackPort,
              streamPath: action.fallbackStreamPath,
              streamProtocol: 'rtsp',
            },
      }

    case 'ALL_DETECTION_LABELS_LOADED':
      return { ...state, allDetectionLabels: action.labels }

    case 'DETECTION_CONFIG_LOAD_STARTED':
      return {
        ...state,
        editForm: action.editForm,
        editPassword: '',
        detectionLabels: ['person'],
        detectionAvailableLabels: [],
        detectionContinuousRecording: false,
        strategyFeedback: null,
        detectionConfigLoading: true,
      }

    case 'DETECTION_CONFIG_LOADED':
      return {
        ...state,
        detectionConfigLoading: false,
        pendingStrategy: action.strategy,
        ...(action.config
          ? {
              detectionLabels: action.config.labels,
              detectionAvailableLabels: action.config.availableLabels,
              detectionContinuousRecording: action.config.continuousRecordingEnabled,
              detectionMotionSensitivity: action.config.motionSensitivity,
              detectionMotionSensitivityPinned: action.config.motionSensitivityPinned,
            }
          : {}),
      }

    case 'DETECTION_LABELS_TOGGLED':
      return { ...state, detectionLabels: action.labels }

    case 'DETECTION_CONTINUOUS_TOGGLED':
      return { ...state, detectionContinuousRecording: action.value }

    case 'MOTION_SENSITIVITY_CHANGED':
      return { ...state, detectionMotionSensitivity: action.value }

    case 'MOTION_SENSITIVITY_PIN_TOGGLED':
      return { ...state, detectionMotionSensitivityPinned: action.pinned }

    case 'DISCOVERY_STARTED':
      return { ...state, discoverLoading: true, discoveryError: null, formError: null }

    case 'DISCOVERY_SUCCEEDED': {
      const base = { ...state, discoverLoading: false, discoveryResults: action.candidates }
      if (!action.selectFirst) {
        return { ...base, formMessage: action.message }
      }
      const first = action.candidates[0]
      return {
        ...base,
        selection: { kind: 'candidate', index: 0 },
        draftVerification: null,
        dvripMode: false,
        form: {
          ...state.form,
          displayName: first.displayName,
          host: first.host,
          port: first.port,
          sourceType: first.sourceType,
          streamPath: first.streamPath,
          vendorFamily: first.vendorFamily,
          streamProtocol: 'rtsp',
        },
        formMessage: action.message,
      }
    }

    case 'DISCOVERY_FAILED':
      return { ...state, discoverLoading: false, discoveryError: action.message }

    case 'CREATE_STARTED':
      return {
        ...state,
        createLoading: true,
        formError: null,
        formMessage: null,
        detailMessage: null,
      }

    case 'CREATE_SUCCEEDED':
      return {
        ...state,
        createLoading: false,
        selection: { kind: 'camera', cameraId: action.cameraId },
        draftVerification: null,
      }

    case 'CREATE_FAILED':
      return { ...state, createLoading: false, formError: action.message }

    case 'VERIFY_DRAFT_STARTED':
      return { ...state, verifyDraftLoading: true, formError: null, formMessage: null }

    case 'VERIFY_DRAFT_SUCCEEDED':
      return action.connected
        ? {
            ...state,
            verifyDraftLoading: false,
            draftVerification: { connected: true, guidance: action.guidance },
            formMessage: action.message,
          }
        : {
            ...state,
            verifyDraftLoading: false,
            draftVerification: null,
            formError: action.message,
          }

    case 'VERIFY_DRAFT_FAILED':
      return {
        ...state,
        verifyDraftLoading: false,
        draftVerification: null,
        formError: action.message,
      }

    case 'VERIFY_STARTED':
      return { ...state, verifyLoading: true, detailError: null, detailMessage: null }

    case 'VERIFY_SUCCEEDED':
      return { ...state, verifyLoading: false, detailMessage: action.message }

    case 'VERIFY_FAILED':
      return { ...state, verifyLoading: false, detailError: action.message }

    case 'REFRESH_CANDIDATE_STARTED':
      return { ...state, refreshLoading: true, formError: null, formMessage: null }

    case 'REFRESH_CANDIDATE_SUCCEEDED': {
      const nextResults = [...state.discoveryResults]
      nextResults[action.index] = action.candidate
      return {
        ...state,
        refreshLoading: false,
        discoveryResults: nextResults,
        selection: { kind: 'candidate', index: action.index },
        draftVerification: null,
        dvripMode: false,
        form: {
          ...state.form,
          displayName: action.candidate.displayName,
          host: action.candidate.host,
          port: action.candidate.port,
          sourceType: action.candidate.sourceType,
          streamPath: action.candidate.streamPath,
          vendorFamily: action.candidate.vendorFamily,
          streamProtocol: 'rtsp',
        },
        formMessage: action.message,
      }
    }

    case 'REFRESH_CANDIDATE_NO_CHANGE':
      return { ...state, refreshLoading: false, formMessage: action.message }

    case 'REFRESH_CANDIDATE_FAILED':
      return { ...state, refreshLoading: false, formError: action.message }

    case 'DELETE_STARTED':
      return { ...state, deleteLoading: true, detailError: null, detailMessage: null }

    case 'DELETE_SUCCEEDED':
      return { ...state, deleteLoading: false }

    case 'DELETE_FAILED':
      return { ...state, deleteLoading: false, detailError: action.message }

    case 'UPDATE_STARTED':
      return { ...state, updateLoading: true, detailError: null, detailMessage: null }

    case 'UPDATE_SUCCEEDED':
      return { ...state, updateLoading: false, editPassword: '' }

    case 'UPDATE_FAILED':
      return { ...state, updateLoading: false, detailError: action.message }

    case 'APPLY_STARTED':
      return { ...state, applyLoading: true, formError: null, detailError: null }

    case 'APPLY_SUCCEEDED':
      return { ...state, applyLoading: false }

    case 'APPLY_NOT_APPLIED':
    case 'APPLY_FAILED':
      return {
        ...state,
        applyLoading: false,
        ...(action.scope === 'detail'
          ? { detailError: action.message }
          : { formError: action.message }),
      }

    case 'STRATEGY_PENDING_CHANGED':
      return { ...state, pendingStrategy: action.value, strategyFeedback: null }

    case 'SAVE_STRATEGY_STARTED':
      return { ...state, saveStrategyLoading: true, strategyFeedback: null }

    case 'SAVE_STRATEGY_SUCCEEDED':
      return { ...state, saveStrategyLoading: false, strategyFeedback: 'Stratégie enregistrée.' }

    case 'SAVE_STRATEGY_FAILED':
      return { ...state, saveStrategyLoading: false, strategyFeedback: action.message }

    case 'CONFIRM_DELETE_SET':
      return { ...state, confirmDelete: action.value }

    case 'CONFIRM_SCAN_SET':
      return { ...state, confirmScan: action.value }

    case 'CONFIRM_APPLY_SET':
      return { ...state, confirmApply: action.value }

    case 'TOAST_ERROR_RAISED':
      return state
  }
}

const emptyDraftPatch = {
  displayName: '',
  host: '',
  port: 554,
  username: null,
  password: null,
  streamPath: null,
  vendorFamily: null,
  sourceType: 'rtsp_manual',
  streamProtocol: 'rtsp',
} as const
