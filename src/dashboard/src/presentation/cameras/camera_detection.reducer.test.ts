import { describe, expect, it } from 'vitest'
import { makeDetectionConfig } from '../../testing/detection_config_fixture'
import { cameraDetectionReducer } from './camera_detection.reducer'
import { buildInitialCameraDetectionUido } from './camera_detection.uido'

describe('cameraDetectionReducer', () => {
  it('cameraDetectionReducer_ShouldDropTheShownSettings_WhenTheCameraIsGone', () => {
    // Arrange
    const state = {
      ...buildInitialCameraDetectionUido(),
      loading: false,
      config: makeDetectionConfig(),
    }

    // Act
    const next = cameraDetectionReducer(state, { type: 'CAMERA_GONE' })

    // Assert
    expect(next.config).toBeNull()
  })

  it('cameraDetectionReducer_ShouldShowWhatTheSaveKept_WhenTheSaveSucceeds', () => {
    // Arrange
    const state = {
      ...buildInitialCameraDetectionUido(),
      loading: false,
      config: makeDetectionConfig(),
    }
    const saved = makeDetectionConfig({ labels: ['person', 'car'] })

    // Act
    const next = cameraDetectionReducer(state, { type: 'SAVE_SUCCEEDED', config: saved })

    // Assert
    expect(next.config).toBe(saved)
  })
})
