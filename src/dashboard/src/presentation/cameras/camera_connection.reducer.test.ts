import { describe, expect, it } from 'vitest'
import { AppErrorKind, type AppError } from '../../common/errors/app_error'
import { makeCapabilityBinding } from '../../testing/capability_binding_fixture'
import { cameraConnectionReducer } from './camera_connection.reducer'
import { buildInitialCameraConnectionUido, CapabilityTask } from './camera_connection.uido'

const readError: AppError = { kind: AppErrorKind.Server, status: 500 }

describe('cameraConnectionReducer', () => {
  it('cameraConnectionReducer_ShouldFreeOnlyThatCapability_WhenItsTaskFinishes', () => {
    // Arrange
    const state = {
      ...buildInitialCameraConnectionUido(),
      pending: { ptz: CapabilityTask.TogglePtz, image_settings: CapabilityTask.Remove },
    }

    // Act
    const next = cameraConnectionReducer(state, { type: 'TASK_FINISHED', capability: 'ptz' })

    // Assert
    expect(next.pending).toEqual({ image_settings: CapabilityTask.Remove })
  })

  it('cameraConnectionReducer_ShouldCloseTheQuestion_WhenTheDeleteFinishes', () => {
    // Arrange
    const state = { ...buildInitialCameraConnectionUido(), confirmDelete: true, deleting: true }

    // Act
    const next = cameraConnectionReducer(state, { type: 'DELETE_FINISHED' })

    // Assert
    expect(next.confirmDelete).toBe(false)
    expect(next.deleting).toBe(false)
  })

  it('cameraConnectionReducer_ShouldOfferNoCapabilityAndKeepTheError_WhenTheReadFails', () => {
    // Arrange
    const state = cameraConnectionReducer(buildInitialCameraConnectionUido(), {
      type: 'BINDINGS_LOADED',
      bindings: [makeCapabilityBinding()],
    })

    // Act
    const next = cameraConnectionReducer(state, { type: 'BINDINGS_FAILED', error: readError })

    // Assert
    expect(next.bindings).toEqual([])
    expect(next.bindingsError).toEqual(readError)
    expect(next.bindingsLoading).toBe(false)
  })

  it('cameraConnectionReducer_ShouldClearTheFailure_WhenTheReadStartsAgain', () => {
    // Arrange
    const state = cameraConnectionReducer(buildInitialCameraConnectionUido(), {
      type: 'BINDINGS_FAILED',
      error: readError,
    })

    // Act
    const next = cameraConnectionReducer(state, { type: 'BINDINGS_STARTED' })

    // Assert
    expect(next.bindingsError).toBeNull()
  })

  it('cameraConnectionReducer_ShouldSayTheCameraIsGone_WhenItNoLongerExists', () => {
    // Arrange
    const state = buildInitialCameraConnectionUido()

    // Act
    const next = cameraConnectionReducer(state, { type: 'CAMERA_GONE' })

    // Assert
    expect(next.cameraGone).toBe(true)
    expect(next.bindingsLoading).toBe(false)
  })
})
