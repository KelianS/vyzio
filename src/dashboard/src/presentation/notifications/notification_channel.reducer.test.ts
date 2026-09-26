import { describe, expect, it } from 'vitest'
import { notificationChannelReducer } from './notification_channel.reducer'
import { buildInitialNotificationChannelUido } from './notification_channel.uido'

describe('notificationChannelReducer', () => {
  it('notificationChannelReducer_ShouldCloseTheQuestion_WhenTheRemovalFinishes', () => {
    // Arrange
    const state = { ...buildInitialNotificationChannelUido(), confirmRemove: true, removing: true }

    // Act
    const next = notificationChannelReducer(state, { type: 'REMOVE_FINISHED' })

    // Assert
    expect(next.confirmRemove).toBe(false)
    expect(next.removing).toBe(false)
  })
})
