import { describe, expect, it } from 'vitest'
import { AppErrorKind } from '../../common/errors/app_error'
import { accessGateReducer } from './access_gate.reducer'
import { buildInitialAccessGateUido } from './access_gate.uido'

describe('accessGateReducer', () => {
  it('accessGateReducer_ShouldForgetTheEndedSession_WhenTheGateReadsAgain', () => {
    // Arrange
    const state = { ...buildInitialAccessGateUido(), loading: false, expired: true }

    // Act
    const next = accessGateReducer(state, { type: 'LOAD_STARTED' })

    // Assert
    expect(next.expired).toBe(false)
  })

  it('accessGateReducer_ShouldClearTheRefusal_WhenTheUserTriesAgain', () => {
    // Arrange
    const state = { ...buildInitialAccessGateUido(), refused: true }

    // Act
    const next = accessGateReducer(state, { type: 'SIGN_IN_STARTED' })

    // Assert
    expect(next.refused).toBe(false)
  })

  it('accessGateReducer_ShouldKeepTheErrorOnScreen_WhenVyzioIsAskedAgain', () => {
    // Arrange
    const error = { kind: AppErrorKind.Network }
    const state = { ...buildInitialAccessGateUido(), loading: false, error }

    // Act
    const next = accessGateReducer(state, { type: 'RETRY_STARTED' })

    // Assert
    expect(next).toEqual({ ...state, retrying: true })
  })
})
