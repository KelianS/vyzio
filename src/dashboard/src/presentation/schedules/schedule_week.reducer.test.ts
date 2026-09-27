import { describe, expect, it } from 'vitest'
import { AppErrorKind, type AppError } from '../../common/errors/app_error'
import { ScheduleRuleKind } from '../../domain/entities/schedule_rule.entity'
import { scheduleWeekReducer } from './schedule_week.reducer'
import { buildInitialScheduleWeekUido } from './schedule_week.uido'

const serverError: AppError = { kind: AppErrorKind.Server, status: 500 }

const loaded = scheduleWeekReducer(buildInitialScheduleWeekUido(), {
  type: 'LOAD_SUCCEEDED',
  rules: [
    {
      id: 'rule-1',
      kind: ScheduleRuleKind.Privacy,
      targetIds: ['camera-1'],
      daysOfWeek: [1],
      startTime: '22:00',
      endTime: '06:00',
      createdAt: '2026-01-01T00:00:00Z',
    },
  ],
  channels: [],
  clock: { dayOfWeek: 1, time: '21:00' },
})

describe('scheduleWeekReducer', () => {
  it('scheduleWeekReducer_ShouldDropTheRulesAndTheClockShown_WhenAReadFails', () => {
    // Act
    const next = scheduleWeekReducer(loaded, { type: 'LOAD_FAILED', error: serverError })

    // Assert
    expect(next).toMatchObject({ rules: [], clock: null, loading: false, error: serverError })
  })

  it('scheduleWeekReducer_ShouldMoveOnlyTheClock_WhenTheClockIsReadAgain', () => {
    // Act
    const next = scheduleWeekReducer(loaded, {
      type: 'CLOCK_READ',
      clock: { dayOfWeek: 1, time: '21:01' },
    })

    // Assert
    expect(next).toEqual({ ...loaded, clock: { dayOfWeek: 1, time: '21:01' } })
  })
})
