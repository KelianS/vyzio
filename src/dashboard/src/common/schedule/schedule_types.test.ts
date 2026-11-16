import { describe, expect, it } from 'vitest'
import { ScheduleRuleKind, type ScheduleRule } from '../../domain/entities/schedule_rule.entity'
import { endsNextDay, rangeCount, rulesTargeting } from './schedule_types'

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

describe('endsNextDay', () => {
  it.each([
    ['22:00', '06:00', true],
    ['08:00', '12:00', false],
    ['22:00', '', false],
    ['', '06:00', false],
  ])(
    'endsNextDay_ShouldTellWhetherTheRangeRunsPastMidnight_WhenItGoesFrom %s to %s',
    (start, end, expected) => {
      // Act
      const next = endsNextDay(start, end)

      // Assert
      expect(next).toBe(expected)
    },
  )
})

describe('rulesTargeting', () => {
  it('rulesTargeting_ShouldCountOnlyTheRulesOfTheTypeAimingAtTheTarget_WhenTheHouseHasSeveral', () => {
    // Arrange
    const rules = [
      makeRule({ id: 'here', targetIds: ['camera-1', 'camera-2'] }),
      makeRule({ id: 'elsewhere', targetIds: ['camera-2'] }),
      makeRule({
        id: 'other-type',
        kind: ScheduleRuleKind.MuteNotifications,
        targetIds: ['camera-1'],
      }),
    ]

    // Act
    const count = rulesTargeting(rules, ScheduleRuleKind.Privacy, 'camera-1')

    // Assert
    expect(count).toBe(1)
  })
})

describe('rangeCount', () => {
  it.each([
    [1, '1 plage'],
    [3, '3 plages'],
  ])('rangeCount_ShouldAgreeWithTheCount_WhenSomeRangesApply (%i)', (count, expected) => {
    // Act
    const label = rangeCount(count)

    // Assert
    expect(label).toBe(expected)
  })

  it('rangeCount_ShouldSayNothing_WhenNoRangeApplies', () => {
    // Act
    const label = rangeCount(0)

    // Assert
    expect(label).toBeNull()
  })
})
