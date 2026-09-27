import { describe, expect, it } from 'vitest'
import { AppErrorKind, type AppError } from '../../common/errors/app_error'
import type { CameraPrivacySchedule } from '../../domain/entities/camera_privacy_schedule.entity'
import {
  PARKING_PRESET_ID,
  SURVEILLANCE_PRESET_ID,
  type PtzPreset,
} from '../../domain/entities/ptz_preset.entity'
import { cameraPrivacyReducer } from './camera_privacy.reducer'
import { buildInitialCameraPrivacyUido } from './camera_privacy.uido'

const readError: AppError = { kind: AppErrorKind.Server, status: 500 }

const schedule: CameraPrivacySchedule = {
  id: 'schedule-1',
  cameraId: 'camera-1',
  enabled: true,
  daysOfWeek: [1],
  startTime: '22:00',
  endTime: '06:00',
  createdAt: '2026-01-01T00:00:00Z',
}

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

  it('cameraPrivacyReducer_ShouldDropTheShownRangesAndKeepTheError_WhenTheirReadFails', () => {
    // Arrange
    const state = cameraPrivacyReducer(buildInitialCameraPrivacyUido(), {
      type: 'SCHEDULES_LOADED',
      schedules: [schedule],
    })

    // Act
    const next = cameraPrivacyReducer(state, { type: 'SCHEDULES_READ_FAILED', error: readError })

    // Assert
    expect(next.schedules).toEqual([])
    expect(next.schedulesError).toEqual(readError)
    expect(next.schedulesLoading).toBe(false)
  })

  it('cameraPrivacyReducer_ShouldClearTheError_WhenTheRangesLoad', () => {
    // Arrange
    const state = cameraPrivacyReducer(buildInitialCameraPrivacyUido(), {
      type: 'SCHEDULES_READ_FAILED',
      error: readError,
    })

    // Act
    const next = cameraPrivacyReducer(state, { type: 'SCHEDULES_LOADED', schedules: [schedule] })

    // Assert
    expect(next.schedulesError).toBeNull()
    expect(next.schedules).toEqual([schedule])
  })

  it('cameraPrivacyReducer_ShouldListTheRange_WhenItIsAdded', () => {
    // Arrange
    const state = cameraPrivacyReducer(buildInitialCameraPrivacyUido(), {
      type: 'SCHEDULES_LOADED',
      schedules: [],
    })

    // Act
    const next = cameraPrivacyReducer(state, { type: 'SCHEDULE_ADDED', schedule })

    // Assert
    expect(next.schedules).toEqual([schedule])
  })

  it('cameraPrivacyReducer_ShouldFoldTheFormAndDropWhatWasComposed_WhenItCloses', () => {
    // Arrange
    const opened = cameraPrivacyReducer(buildInitialCameraPrivacyUido(), {
      type: 'SCHEDULE_FORM_OPENED',
    })
    const composed = cameraPrivacyReducer(opened, { type: 'DAY_TOGGLED', day: 0 })
    const refused = cameraPrivacyReducer(composed, { type: 'SCHEDULE_INVALID', message: 'jour' })
    const failed = cameraPrivacyReducer(refused, { type: 'SCHEDULE_FAILED', error: readError })

    // Act
    const next = cameraPrivacyReducer(failed, { type: 'SCHEDULE_FORM_CLOSED' })

    // Assert
    expect(next.formOpen).toBe(false)
    expect(next.form).toEqual(buildInitialCameraPrivacyUido().form)
    expect(next.invalid).toBeNull()
    expect(next.scheduleFailure).toBeNull()
  })

  it('cameraPrivacyReducer_ShouldDropTheFailure_WhenARangeIsDeleted', () => {
    // Arrange
    const loaded = cameraPrivacyReducer(buildInitialCameraPrivacyUido(), {
      type: 'SCHEDULES_LOADED',
      schedules: [schedule],
    })
    const failed = cameraPrivacyReducer(loaded, { type: 'SCHEDULE_FAILED', error: readError })

    // Act
    const next = cameraPrivacyReducer(failed, {
      type: 'SCHEDULE_DELETED',
      scheduleId: 'schedule-1',
    })

    // Assert
    expect(next.scheduleFailure).toBeNull()
  })

  it('cameraPrivacyReducer_ShouldDropAnEarlierFailure_WhenTheFormOpens', () => {
    // Arrange
    const failed = cameraPrivacyReducer(buildInitialCameraPrivacyUido(), {
      type: 'SCHEDULE_FAILED',
      error: readError,
    })

    // Act
    const next = cameraPrivacyReducer(failed, { type: 'SCHEDULE_FORM_OPENED' })

    // Assert
    expect(next.formOpen).toBe(true)
    expect(next.scheduleFailure).toBeNull()
  })
})
