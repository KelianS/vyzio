import { describe, expect, it } from 'vitest'
import { accessReducer } from './access.reducer'
import { buildInitialAccessUido } from './access.uido'

describe('accessReducer', () => {
  it('accessReducer_ShouldClearTheRefusal_WhenTheUserTriesAgain', () => {
    // Arrange
    const state = { ...buildInitialAccessUido(), refused: true }

    // Act
    const next = accessReducer(state, { type: 'CHANGE_STARTED' })

    // Assert
    expect(next.refused).toBe(false)
  })
})
