import { describe, expect, it } from 'vitest'
import { cameraConnectionReducer } from './camera_connection.reducer'
import { buildInitialCameraConnectionUido, CapabilityTask } from './camera_connection.uido'

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
})
