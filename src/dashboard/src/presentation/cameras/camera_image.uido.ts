import type { AppError } from '../../common/errors/app_error'
import type { CameraImageSettings } from '../../domain/entities/camera_image_settings.entity'

export interface CameraImageUido {
  settings: CameraImageSettings | null
  settingsLoading: boolean
  settingsError: AppError | null
  cameraGone: boolean
  /** Sharpness and night vision are offered only where writing them is confirmed (ADR-29). */
  writableBeyondBasics: boolean
  /** Whether sharpness and night vision are writable could not be read. */
  bindingsError: AppError | null
  saving: boolean

  ptzLoading: boolean
  ptzError: AppError | null
  /** Without a reference the camera cannot hold saved positions. */
  calibrated: boolean
  currentPosition: { x: number; y: number } | null
  liveViewOpen: boolean
}

export function buildInitialCameraImageUido(): CameraImageUido {
  return {
    settings: null,
    settingsLoading: true,
    settingsError: null,
    cameraGone: false,
    writableBeyondBasics: false,
    bindingsError: null,
    saving: false,

    ptzLoading: true,
    ptzError: null,
    calibrated: true,
    currentPosition: null,
    liveViewOpen: false,
  }
}
