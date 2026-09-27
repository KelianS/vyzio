import { describe, expect, it } from 'vitest'
import { ScheduleRuleKind, type ScheduleRule } from '../../domain/entities/schedule_rule.entity'
import { entryTimes, targetSummary, weekOf } from './schedule_week.formatters'

function makeRule(overrides: Partial<ScheduleRule> = {}): ScheduleRule {
  return {
    id: 'rule-1',
    kind: ScheduleRuleKind.Privacy,
    targetIds: ['camera-1'],
    daysOfWeek: [1],
    startTime: '22:00',
    endTime: '06:00',
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

const NAMES: Record<string, string> = {
  'camera-1': 'Salon',
  'camera-2': 'Cuisine',
  'camera-3': 'Entrée',
  'camera-4': 'Jardin',
}
const nameOf = (_kind: ScheduleRuleKind, id: string) => NAMES[id]

describe('weekOf', () => {
  it('weekOf_ShouldStartOnMonday_WhenTheWeekIsListed', () => {
    // Act
    const week = weekOf([])

    // Assert
    expect(week.map((day) => day.name)).toEqual([
      'Lundi',
      'Mardi',
      'Mercredi',
      'Jeudi',
      'Vendredi',
      'Samedi',
      'Dimanche',
    ])
  })

  it('weekOf_ShouldShowTheNightOnItsDayAndItsTailTheDayAfter_WhenTheRangeCrossesMidnight', () => {
    // Arrange
    const night = makeRule({ daysOfWeek: [1] })

    // Act
    const [monday, tuesday, wednesday] = weekOf([night])

    // Assert
    expect(monday.entries).toEqual([{ rule: night, tail: false }])
    expect(tuesday.entries).toEqual([{ rule: night, tail: true }])
    expect(wednesday.entries).toEqual([])
  })

  it('weekOf_ShouldCarrySundayNightIntoMonday_WhenTheWeekWrapsAround', () => {
    // Arrange
    const sundayNight = makeRule({ daysOfWeek: [0] })

    // Act
    const [monday] = weekOf([sundayNight])

    // Assert
    expect(monday.entries).toEqual([{ rule: sundayNight, tail: true }])
  })

  it('weekOf_ShouldListTheTailBeforeWhatStartsLater_WhenADayHasBoth', () => {
    // Arrange
    const night = makeRule({ id: 'night', daysOfWeek: [1] })
    const morning = makeRule({
      id: 'morning',
      daysOfWeek: [2],
      startTime: '08:00',
      endTime: '12:00',
    })

    // Act
    const tuesday = weekOf([morning, night])[1]

    // Assert
    expect(tuesday.entries.map((entry) => entry.rule.id)).toEqual(['night', 'morning'])
  })
})

describe('entryTimes', () => {
  it.each([
    [{ rule: makeRule(), tail: false }, '22:00 → 06:00 le lendemain'],
    [{ rule: makeRule(), tail: true }, 'jusqu’à 06:00, depuis la veille'],
    [{ rule: makeRule({ startTime: '08:00', endTime: '12:00' }), tail: false }, '08:00 → 12:00'],
  ])('entryTimes_ShouldSayWhenTheRangeRuns_WhenTheWeekShowsIt %#', (entry, expected) => {
    // Act
    const times = entryTimes(entry)

    // Assert
    expect(times).toBe(expected)
  })
})

describe('targetSummary', () => {
  it.each([
    [['camera-1'], 'Salon'],
    [['camera-1', 'camera-2'], 'Salon, Cuisine'],
    [['camera-1', 'camera-2', 'camera-3'], 'Salon, Cuisine et 1 autre'],
    [['camera-1', 'camera-2', 'camera-3', 'camera-4'], 'Salon, Cuisine et 2 autres'],
    [['camera-1', 'removed'], 'Salon'],
    [['removed'], null],
  ])(
    'targetSummary_ShouldNameTwoTargetsAtMostAndLeaveOutTheRemoved_WhenARuleTargets %j',
    (targetIds, expected) => {
      // Act
      const summary = targetSummary(makeRule({ targetIds }), nameOf)

      // Assert
      expect(summary).toBe(expected)
    },
  )
})
