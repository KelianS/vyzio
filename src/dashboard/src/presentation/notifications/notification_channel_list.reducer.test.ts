import { describe, expect, it } from 'vitest'
import { AppErrorKind, type AppError } from '../../common/errors/app_error'
import { makeChannelSummary } from '../../testing/notification_fixture'
import { notificationChannelListReducer } from './notification_channel_list.reducer'
import { buildInitialNotificationChannelListUido } from './notification_channel_list.uido'

const SERVER_ERROR: AppError = { kind: AppErrorKind.Server, status: 500 }

describe('notificationChannelListReducer', () => {
  it('notificationChannelListReducer_ShouldHoldTheFailureAndNoChannel_WhenTheListCannotBeRead', () => {
    // Arrange
    const state = { ...buildInitialNotificationChannelListUido(), channels: [makeChannelSummary()] }

    // Act
    const next = notificationChannelListReducer(state, { type: 'LOAD_FAILED', error: SERVER_ERROR })

    // Assert
    expect(next.error).toEqual(SERVER_ERROR)
    expect(next.channels).toEqual([])
    expect(next.loading).toBe(false)
  })

  it('notificationChannelListReducer_ShouldClearTheFailure_WhenTheListIsReadAgain', () => {
    // Arrange
    const state = {
      ...buildInitialNotificationChannelListUido(),
      loading: false,
      error: SERVER_ERROR,
    }

    // Act
    const next = notificationChannelListReducer(state, { type: 'LOAD_STARTED' })

    // Assert
    expect(next.error).toBeNull()
    expect(next.loading).toBe(true)
  })
})
