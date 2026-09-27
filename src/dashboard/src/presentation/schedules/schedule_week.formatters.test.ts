import { describe, expect, it } from 'vitest'
import { ScheduleRuleKind, type ScheduleRule } from '../../domain/entities/schedule_rule.entity'
import { barOf, entryTimes, targetSummary, weekOf } from './schedule_week.formatters'

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

  it('weekOf_ShouldLeaveTheNextDayEmpty_WhenTheRangeEndsAtMidnightSharp', () => {
    // Arrange
    const evening = makeRule({ daysOfWeek: [1], startTime: '20:00', endTime: '00:00' })

    // Act
    const tuesday = weekOf([evening])[1]

    // Assert
    expect(tuesday.entries).toEqual([])
  })
})

describe('barOf', () => {
  it('barOf_ShouldRunTheNightToMidnightAndItsTailFromMidnight_WhenTheRangeCrossesMidnight', () => {
    // Arrange
    const night = makeRule({ daysOfWeek: [1] })
    const [monday, tuesday] = weekOf([night])

    // Act
    const evening = barOf(monday.entries).blocks
    const morning = barOf(tuesday.entries).blocks

    // Assert
    expect(evening).toEqual([
      { entry: monday.entries[0], start: 1320, end: 1440, continues: true, lane: 0 },
    ])
    expect(morning).toEqual([
      { entry: tuesday.entries[0], start: 0, end: 360, continues: false, lane: 0 },
    ])
  })

  it('barOf_ShouldStackOverlappingRangesInLanes_WhenTwoRangesShareHours', () => {
    // Arrange
    const privacy = makeRule({ id: 'privacy', startTime: '08:00', endTime: '12:00' })
    const muted = makeRule({ id: 'muted', startTime: '10:00', endTime: '14:00' })
    const evening = makeRule({ id: 'evening', startTime: '18:00', endTime: '20:00' })
    const [monday] = weekOf([privacy, muted, evening])

    // Act
    const bar = barOf(monday.entries)

    // Assert
    expect(bar.blocks.map((block) => [block.entry.rule.id, block.lane])).toEqual([
      ['privacy', 0],
      ['muted', 1],
      ['evening', 0],
    ])
    expect(bar.lanes).toBe(2)
  })

  it('barOf_ShouldKeepOneLane_WhenTheDayIsEmpty', () => {
    // Act
    const bar = barOf([])

    // Assert
    expect(bar).toEqual({ blocks: [], lanes: 1 })
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
