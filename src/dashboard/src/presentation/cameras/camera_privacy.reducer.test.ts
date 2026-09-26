import { describe, expect, it } from 'vitest'
import {
  PARKING_PRESET_ID,
  SURVEILLANCE_PRESET_ID,
  type PtzPreset,
} from '../../domain/entities/ptz_preset.entity'
import { cameraPrivacyReducer } from './camera_privacy.reducer'
import { buildInitialCameraPrivacyUido } from './camera_privacy.uido'

function preset(presetId: number, configured: boolean): PtzPreset {
  return { presetId, label: '', native: false, stepsX: null, stepsY: null, configured }
}

describe('cameraPrivacyReducer', () => {
  it.each([
    {
      presets: [preset(PARKING_PRESET_ID, true), preset(SURVEILLANCE_PRESET_ID, true)],
      saved: true,
    },
    {
      presets: [preset(PARKING_PRESET_ID, true), preset(SURVEILLANCE_PRESET_ID, false)],
      saved: false,
    },
    { presets: [preset(SURVEILLANCE_PRESET_ID, true)], saved: false },
  ])(
    'cameraPrivacyReducer_ShouldSayWhetherThePositionsAreSaved_WhenThePresetsLoad (saved: $saved)',
    ({ presets, saved }) => {
      // Arrange
      const state = buildInitialCameraPrivacyUido()

      // Act
      const next = cameraPrivacyReducer(state, { type: 'PRESETS_LOADED', presets })

      // Assert
      expect(next.positionsSaved).toBe(saved)
    },
  )

  it('cameraPrivacyReducer_ShouldKeepTheDaysInWeekOrder_WhenADayIsAddedBack', () => {
    // Arrange
    const state = cameraPrivacyReducer(buildInitialCameraPrivacyUido(), {
      type: 'DAY_TOGGLED',
      day: 1,
    })

    // Act
    const next = cameraPrivacyReducer(state, { type: 'DAY_TOGGLED', day: 1 })

    // Assert
    expect(next.form.days).toEqual([1, 2, 3, 4, 5])
  })
})
