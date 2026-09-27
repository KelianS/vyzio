import { describe, expect, it } from 'vitest'
import { AppErrorKind, type AppError } from '../../common/errors/app_error'
import type { CameraImageSettings } from '../../domain/entities/camera_image_settings.entity'
import { makeCapabilityBinding } from '../../testing/capability_binding_fixture'
import { cameraImageReducer } from './camera_image.reducer'
import { buildInitialCameraImageUido } from './camera_image.uido'

const settings: CameraImageSettings = {
  brightness: 50,
  contrast: 50,
  saturation: 50,
  sharpness: 50,
  irCutMode: 'auto',
}

const readError: AppError = { kind: AppErrorKind.Server, status: 500 }

describe('cameraImageReducer', () => {
  it.each([
    { bindings: [makeCapabilityBinding({ protocol: 'dvrip' })], writable: false },
    { bindings: [makeCapabilityBinding({ protocol: 'onvif' })], writable: true },
    { bindings: [], writable: true },
  ])(
    'cameraImageReducer_ShouldOfferSharpnessAndNightVisionOnlyWhereWritable_WhenTheBindingsLoad (writable: $writable)',
    ({ bindings, writable }) => {
      // Arrange
      const state = buildInitialCameraImageUido()

      // Act
      const next = cameraImageReducer(state, { type: 'BINDINGS_LOADED', bindings })

      // Assert
      expect(next.writableBeyondBasics).toBe(writable)
    },
  )

  it('cameraImageReducer_ShouldKeepTheErrorAndNoSettings_WhenTheReadFails', () => {
    // Arrange
    const state = buildInitialCameraImageUido()

    // Act
    const next = cameraImageReducer(state, { type: 'SETTINGS_FAILED', error: readError })

    // Assert
    expect(next.settingsError).toEqual(readError)
    expect(next.settings).toBeNull()
    expect(next.settingsLoading).toBe(false)
  })

  it('cameraImageReducer_ShouldClearTheFailure_WhenTheReadStartsAgain', () => {
    // Arrange
    const state = cameraImageReducer(buildInitialCameraImageUido(), {
      type: 'SETTINGS_FAILED',
      error: readError,
    })

    // Act
    const next = cameraImageReducer(state, { type: 'SETTINGS_STARTED' })

    // Assert
    expect(next.settingsError).toBeNull()
    expect(next.settingsLoading).toBe(true)
  })

  it('cameraImageReducer_ShouldSayTheCameraIsGone_WhenItNoLongerExists', () => {
    // Arrange
    const state = buildInitialCameraImageUido()

    // Act
    const next = cameraImageReducer(state, { type: 'CAMERA_GONE' })

    // Assert
    expect(next.cameraGone).toBe(true)
    expect(next.settingsLoading).toBe(false)
  })

  it('cameraImageReducer_ShouldShowWhatTheCameraKept_WhenTheSaveAnswers', () => {
    // Arrange
    const state = cameraImageReducer(buildInitialCameraImageUido(), {
      type: 'SETTINGS_LOADED',
      settings,
    })

    // Act
    const next = cameraImageReducer(state, {
      type: 'SETTINGS_SAVED',
      settings: { ...settings, brightness: 60 },
    })

    // Assert
    expect(next.settings).toEqual({ ...settings, brightness: 60 })
  })

  it('cameraImageReducer_ShouldHideSharpnessAndKeepTheError_WhenTheBindingsCannotBeRead', () => {
    // Arrange
    const state = cameraImageReducer(buildInitialCameraImageUido(), {
      type: 'BINDINGS_LOADED',
      bindings: [],
    })

    // Act
    const next = cameraImageReducer(state, { type: 'BINDINGS_FAILED', error: readError })

    // Assert
    expect(next.writableBeyondBasics).toBe(false)
    expect(next.bindingsError).toEqual(readError)
  })
})
