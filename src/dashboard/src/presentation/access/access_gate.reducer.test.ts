import { describe, expect, it } from 'vitest'
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
})
