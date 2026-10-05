import { describe, expect, it } from 'vitest'
import { AppErrorKind, type AppError } from '../../common/errors/app_error'
import type { PtzPreset } from '../../domain/entities/ptz_preset.entity'
import { liveViewReducer } from './live_view.reducer'
import { buildInitialLiveViewUido } from './live_view.uido'

const parking: PtzPreset = {
  presetId: 2,
  label: 'Parking',
  thumbnail: false,
  panMs: 7,
  tiltMs: 4,
}

const readError: AppError = { kind: AppErrorKind.Server, status: 502 }

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

  it('liveViewReducer_ShouldForgetTheSlots_WhenTheCameraCannotSayWhichItHolds', () => {
    // Arrange
    const state = liveViewReducer(buildInitialLiveViewUido(), {
      type: 'PRESETS_LOADED',
      presets: [parking],
      calibrated: true,
      currentPosition: null,
    })

    // Act
    const next = liveViewReducer(state, { type: 'PRESETS_FAILED', error: readError })

    // Assert
    expect(next.presets).toBeNull()
    expect(next.presetsError).toBe(readError)
  })

  it('liveViewReducer_ShouldShowTheHeldSlotWithItsThumbnail_WhenTheCaptureLands', () => {
    // Arrange
    const state = liveViewReducer(buildInitialLiveViewUido(), {
      type: 'PRESETS_LOADED',
      presets: [parking],
      calibrated: true,
      currentPosition: null,
    })

    // Act
    const next = liveViewReducer(state, { type: 'THUMBNAIL_CAPTURED', presetId: 2, version: 9 })

    // Assert
    expect(next.presets).toEqual([{ ...parking, thumbnail: true }])
  })

  it('liveViewReducer_ShouldWatchTheChosenQuality_WhenTheUserSwitchesIt', () => {
    // Arrange
    const state = buildInitialLiveViewUido()

    // Act
    const next = liveViewReducer(state, { type: 'QUALITY_CHOSEN', quality: 'high' })

    // Assert
    expect(state.quality).toBe('low')
    expect(next.quality).toBe('high')
  })

  it('liveViewReducer_ShouldTurnTheSoundOnThenOff_WhenTheUserTogglesItTwice', () => {
    // Arrange
    const state = buildInitialLiveViewUido()

    // Act
    const on = liveViewReducer(state, { type: 'SOUND_TOGGLED' })
    const off = liveViewReducer(on, { type: 'SOUND_TOGGLED' })

    // Assert
    expect([state.soundOn, on.soundOn, off.soundOn]).toEqual([false, true, false])
  })
})
