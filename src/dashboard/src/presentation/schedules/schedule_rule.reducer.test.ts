import { describe, expect, it } from 'vitest'
import { AppErrorKind, type AppError } from '../../common/errors/app_error'
import { scheduleRuleReducer } from './schedule_rule.reducer'
import { buildInitialScheduleRuleUido } from './schedule_rule.uido'

const serverError: AppError = { kind: AppErrorKind.Server, status: 500 }

describe('scheduleRuleReducer', () => {
  it('scheduleRuleReducer_ShouldCloseTheQuestionAndKeepWhy_WhenTheDeleteFails', () => {
    // Arrange
    const asked = scheduleRuleReducer(buildInitialScheduleRuleUido(), { type: 'DELETE_ASKED' })
    const deleting = scheduleRuleReducer(asked, { type: 'DELETE_STARTED' })

    // Act
    const next = scheduleRuleReducer(deleting, { type: 'DELETE_FAILED', error: serverError })

    // Assert
    expect(next).toMatchObject({ confirmDelete: false, deleting: false, failure: serverError })
  })

  it('scheduleRuleReducer_ShouldDropAnEarlierFailure_WhenTheUserTriesAgain', () => {
    // Arrange
    const failed = scheduleRuleReducer(buildInitialScheduleRuleUido(), {
      type: 'SAVE_FAILED',
      error: serverError,
    })

    // Act
    const next = scheduleRuleReducer(failed, { type: 'SAVE_STARTED' })

    // Assert
    expect(next.failure).toBeNull()
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
