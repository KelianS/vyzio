import { describe, expect, it } from 'vitest'
import { personIdentityReducer } from './person_identity.reducer'
import { buildInitialPersonIdentityUido } from './person_identity.uido'

describe('personIdentityReducer', () => {
  it('personIdentityReducer_ShouldCloseTheQuestion_WhenTheDeleteFinishes', () => {
    // Arrange
    const state = { ...buildInitialPersonIdentityUido(), confirmDelete: true, deleting: true }

    // Act
    const next = personIdentityReducer(state, { type: 'DELETE_FINISHED' })

    // Assert
    expect(next.confirmDelete).toBe(false)
    expect(next.deleting).toBe(false)
  })
})
