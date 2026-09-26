import type { AppError } from '../../common/errors/app_error'
import type { CameraImageSettings } from '../../domain/entities/camera_image_settings.entity'

export interface CameraImageUido {
  settings: CameraImageSettings | null
  settingsLoading: boolean
  /** Sharpness and night vision are offered only where writing them is confirmed (ADR-29). */
  writableBeyondBasics: boolean
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
    writableBeyondBasics: true,
    saving: false,

    ptzLoading: true,
    ptzError: null,
    calibrated: true,
    currentPosition: null,
    liveViewOpen: false,
  }
}
