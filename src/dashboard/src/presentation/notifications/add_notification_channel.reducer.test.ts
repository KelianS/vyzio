import { describe, expect, it } from 'vitest'
import { AppErrorKind, type AppError } from '../../common/errors/app_error'
import { makeChannelSummary } from '../../testing/notification_fixture'
import { addNotificationChannelReducer } from './add_notification_channel.reducer'
import { buildInitialAddNotificationChannelUido } from './add_notification_channel.uido'

const SERVER_ERROR: AppError = { kind: AppErrorKind.Server, status: 500 }

describe('addNotificationChannelReducer', () => {
  it('addNotificationChannelReducer_ShouldHoldTheFailureAndNoChannel_WhenTheListCannotBeRead', () => {
    // Arrange
    const state = { ...buildInitialAddNotificationChannelUido(), channels: [makeChannelSummary()] }

    // Act
    const next = addNotificationChannelReducer(state, { type: 'LOAD_FAILED', error: SERVER_ERROR })

    // Assert
    expect(next.error).toEqual(SERVER_ERROR)
    expect(next.channels).toEqual([])
    expect(next.loading).toBe(false)
  })

  it('addNotificationChannelReducer_ShouldClearTheFailure_WhenTheListIsReadAgain', () => {
    // Arrange
    const state = {
      ...buildInitialAddNotificationChannelUido(),
      loading: false,
      error: SERVER_ERROR,
    }

    // Act
    const next = addNotificationChannelReducer(state, { type: 'LOAD_STARTED' })

    // Assert
    expect(next.error).toBeNull()
    expect(next.loading).toBe(true)
  })
})
