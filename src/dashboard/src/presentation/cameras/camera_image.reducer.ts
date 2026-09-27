import type {
  Capability,
  CameraCapabilityBinding,
  SupportedProtocol,
} from '../../domain/entities/camera_capability_binding.entity'
import type { CameraImageAction } from './camera_image.actions'
import type { CameraImageUido } from './camera_image.uido'

// Sharpness and night vision are not confirmed writable over DVRIP (ADR-29): do not offer them silently.
const WRITES_BEYOND_BASICS: Record<SupportedProtocol, boolean> = {
  onvif: true,
  dvrip: false,
  tapo_klap: true,
  v380: true,
  rtsp: true,
}

const IS_IMAGE_SETTINGS: Record<Capability, boolean> = {
  ptz: false,
  hardware_privacy: false,
  image_settings: true,
}

function writableBeyondBasics(bindings: CameraCapabilityBinding[]): boolean {
  const binding = bindings.find((b) => IS_IMAGE_SETTINGS[b.capability])
  return binding ? WRITES_BEYOND_BASICS[binding.protocol] : true
}

export function cameraImageReducer(
  state: CameraImageUido,
  action: CameraImageAction,
): CameraImageUido {
  switch (action.type) {
    // Sharpness and night vision stay hidden until the bindings confirm them (ADR-29).
    case 'SETTINGS_STARTED':
      return {
        ...state,
        settingsLoading: true,
        settingsError: null,
        cameraGone: false,
        writableBeyondBasics: false,
        bindingsError: null,
      }
    case 'SETTINGS_LOADED':
      return { ...state, settingsLoading: false, settings: action.settings }
    case 'BINDINGS_STARTED':
      return { ...state, bindingsError: null }
    case 'BINDINGS_LOADED':
      return { ...state, writableBeyondBasics: writableBeyondBasics(action.bindings) }
    case 'BINDINGS_FAILED':
      return { ...state, writableBeyondBasics: false, bindingsError: action.error }
    case 'SETTINGS_FAILED':
      return { ...state, settingsLoading: false, settings: null, settingsError: action.error }
    case 'SETTINGS_SAVED':
      return { ...state, settings: action.settings }
    case 'CAMERA_GONE':
      return { ...state, settingsLoading: false, settings: null, cameraGone: true }

    case 'SAVE_STARTED':
      return { ...state, saving: true }
    case 'SAVE_FINISHED':
      return { ...state, saving: false }

    case 'PTZ_LOADED':
      return {
        ...state,
        ptzLoading: false,
        ptzError: null,
        calibrated: action.calibrated,
        currentPosition: action.currentPosition,
      }
    case 'PTZ_FAILED':
      return { ...state, ptzLoading: false, ptzError: action.error }

    case 'LIVE_VIEW_OPENED':
      return { ...state, liveViewOpen: true }
    case 'LIVE_VIEW_CLOSED':
      return { ...state, liveViewOpen: false }
  }
}
