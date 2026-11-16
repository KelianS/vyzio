import { describe, expect, it } from 'vitest'
import { scheduleRuleReducer } from './schedule_rule.reducer'
import { buildInitialScheduleRuleUido } from './schedule_rule.uido'

describe('scheduleRuleReducer', () => {
  it('scheduleRuleReducer_ShouldCloseTheQuestion_WhenTheDeleteFails', () => {
    // Arrange
    const asked = scheduleRuleReducer(buildInitialScheduleRuleUido(), { type: 'DELETE_ASKED' })
    const deleting = scheduleRuleReducer(asked, { type: 'DELETE_STARTED' })

    // Act
    const next = scheduleRuleReducer(deleting, { type: 'DELETE_FAILED' })

    // Assert
    expect(next).toMatchObject({ confirmDelete: false, deleting: false })
  })

  it('scheduleRuleReducer_ShouldSayTheRuleIsGoneAndCloseAnyQuestion_WhenItWasDeletedMeanwhile', () => {
    // Arrange
    const asked = scheduleRuleReducer(buildInitialScheduleRuleUido(), { type: 'DELETE_ASKED' })

    // Act
    const next = scheduleRuleReducer(asked, { type: 'RULE_GONE' })

    // Assert
    expect(next).toMatchObject({ gone: true, confirmDelete: false, rule: null, loading: false })
  })
})
