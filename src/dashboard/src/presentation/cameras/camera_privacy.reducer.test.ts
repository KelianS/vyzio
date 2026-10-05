import { describe, expect, it } from 'vitest'
import { AppErrorKind, type AppError } from '../../common/errors/app_error'
import { ScheduleRuleKind, type ScheduleRule } from '../../domain/entities/schedule_rule.entity'
import {
  PARKING_PRESET_ID,
  SURVEILLANCE_PRESET_ID,
  type PtzPreset,
} from '../../domain/entities/ptz_preset.entity'
import { cameraPrivacyReducer } from './camera_privacy.reducer'
import { buildInitialCameraPrivacyUido } from './camera_privacy.uido'

const readError: AppError = { kind: AppErrorKind.Server, status: 500 }

const rule: ScheduleRule = {
  id: 'rule-1',
  kind: ScheduleRuleKind.Privacy,
  targetIds: ['camera-1'],
  daysOfWeek: [1],
  startTime: '22:00',
  endTime: '06:00',
  createdAt: '2026-01-01T00:00:00Z',
}

function preset(presetId: number, thumbnail: boolean): PtzPreset {
  return { presetId, label: '', thumbnail, panMs: null, tiltMs: null }
}

describe('cameraPrivacyReducer', () => {
  it.each([
    {
      presets: [preset(PARKING_PRESET_ID, true), preset(SURVEILLANCE_PRESET_ID, true)],
      saved: true,
    },
    {
      presets: [preset(PARKING_PRESET_ID, false), preset(SURVEILLANCE_PRESET_ID, false)],
      saved: true,
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

  it('cameraPrivacyReducer_ShouldForgetTheCount_WhenTheRulesCannotBeRead', () => {
    // Arrange
    const state = cameraPrivacyReducer(buildInitialCameraPrivacyUido(), {
      type: 'RULES_LOADED',
      rules: [rule],
    })

    // Act
    const next = cameraPrivacyReducer(state, { type: 'RULES_FAILED', error: readError })

    // Assert
    expect(next.rules).toBeNull()
    expect(next.rulesError).toBe(readError)
  })

  it('cameraPrivacyReducer_ShouldKeepTheCountShown_WhenTheRulesAreReadAgain', () => {
    // Arrange
    const state = cameraPrivacyReducer(buildInitialCameraPrivacyUido(), {
      type: 'RULES_LOADED',
      rules: [rule],
    })

    // Act
    const next = cameraPrivacyReducer(state, { type: 'RULES_STARTED' })

    // Assert
    expect(next.rules).toEqual([rule])
  })
})
