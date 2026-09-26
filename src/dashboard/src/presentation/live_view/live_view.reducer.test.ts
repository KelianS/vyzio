import { describe, expect, it } from 'vitest'
import type { PtzPreset } from '../../domain/entities/ptz_preset.entity'
import { liveViewReducer } from './live_view.reducer'
import { buildInitialLiveViewUido } from './live_view.uido'

const parking: PtzPreset = {
  presetId: 2,
  label: 'Parking',
  native: false,
  stepsX: 7,
  stepsY: 4,
  configured: true,
}

describe('liveViewReducer', () => {
  it.each([
    { currentPosition: { x: 7, y: 4 }, active: 2 },
    { currentPosition: { x: 7, y: 5 }, active: null },
    { currentPosition: null, active: null },
  ])(
    'liveViewReducer_ShouldMarkTheSavedPositionTheCameraSitsOn_WhenThePresetsLoad (active: $active)',
    ({ currentPosition, active }) => {
      // Arrange
      const state = buildInitialLiveViewUido()

      // Act
      const next = liveViewReducer(state, {
        type: 'PRESETS_LOADED',
        presets: [parking],
        calibrated: true,
        currentPosition,
      })

      // Assert
      expect(next.activePresetId).toBe(active)
    },
  )
})
