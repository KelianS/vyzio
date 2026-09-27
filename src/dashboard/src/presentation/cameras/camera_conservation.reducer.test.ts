import { describe, expect, it } from 'vitest'
import { makeDetectionConfig } from '../../testing/detection_config_fixture'
import { cameraConservationReducer } from './camera_conservation.reducer'
import { buildInitialCameraConservationUido } from './camera_conservation.uido'

describe('cameraConservationReducer', () => {
  it('cameraConservationReducer_ShouldDropTheShownSettings_WhenTheCameraIsGone', () => {
    // Arrange
    const state = {
      ...buildInitialCameraConservationUido(),
      loading: false,
      config: makeDetectionConfig(),
    }

    // Act
    const next = cameraConservationReducer(state, { type: 'CAMERA_GONE' })

    // Assert
    expect(next.config).toBeNull()
  })

  it('cameraConservationReducer_ShouldShowWhatTheSaveKept_WhenTheSaveSucceeds', () => {
    // Arrange
    const state = {
      ...buildInitialCameraConservationUido(),
      loading: false,
      config: makeDetectionConfig(),
    }
    const saved = makeDetectionConfig({ labels: ['person', 'car'] })

    // Act
    const next = cameraConservationReducer(state, { type: 'SAVE_SUCCEEDED', config: saved })

    // Assert
    expect(next.config).toBe(saved)
  })
})
