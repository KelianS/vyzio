import { describe, expect, it } from 'vitest'
import { notificationChannelReducer } from './notification_channel.reducer'
import { buildInitialNotificationChannelUido } from './notification_channel.uido'
import { makeChannelConfig } from '../../testing/notification_fixture'
import { AppErrorKind, type AppError } from '../../common/errors/app_error'
import type {
  ChannelListening,
  NotificationLogEntry,
} from '../../domain/entities/notification_channel_config.entity'

const SENT: NotificationLogEntry = {
  status: 'sent',
  sentAt: '2026-09-01T08:00:00Z',
  errorMessage: null,
}
const LISTENING: ChannelListening = {
  channel: 'telegram',
  listening: true,
  since: null,
  interruptedAt: null,
  reason: null,
}
const CONFIG = makeChannelConfig()
const SERVER_ERROR: AppError = { kind: AppErrorKind.Server, status: 500 }

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

  it('notificationChannelReducer_ShouldForgetWhatWasRead_WhenAnotherChannelOpens', () => {
    // Arrange
    const state = { ...buildInitialNotificationChannelUido(), log: [SENT], logLoading: false }

    // Act
    const next = notificationChannelReducer(state, { type: 'CHANNEL_OPENED' })

    // Assert
    expect(next).toEqual(buildInitialNotificationChannelUido())
  })

  it('notificationChannelReducer_ShouldKeepTheEntriesShown_WhenARereadOfTheLogFails', () => {
    // Arrange
    const state = { ...buildInitialNotificationChannelUido(), log: [SENT], logLoading: true }

    // Act
    const next = notificationChannelReducer(state, { type: 'LOG_REFRESH_FAILED' })

    // Assert
    expect(next.log).toEqual([SENT])
    expect(next.logError).toBeNull()
    expect(next.logLoading).toBe(false)
  })

  it('notificationChannelReducer_ShouldKeepTheBadge_WhenARereadOfTheListeningFails', () => {
    // Arrange
    const state = {
      ...buildInitialNotificationChannelUido(),
      listening: LISTENING,
      listeningLoading: true,
    }

    // Act
    const next = notificationChannelReducer(state, { type: 'LISTENING_REFRESH_FAILED' })

    // Assert
    expect(next.listening).toEqual(LISTENING)
    expect(next.listeningLoading).toBe(false)
  })

  it('notificationChannelReducer_ShouldClearTheFailure_WhenThePairingIsReadAgain', () => {
    // Arrange
    const state = {
      ...buildInitialNotificationChannelUido(),
      pairingLoading: false,
      pairingError: SERVER_ERROR,
    }

    // Act
    const next = notificationChannelReducer(state, { type: 'PAIRING_STARTED' })

    // Assert
    expect(next.pairingError).toBeNull()
    expect(next.pairingLoading).toBe(true)
  })

  it('notificationChannelReducer_ShouldKeepTheSettingsShown_WhenARereadOfTheSettingsFails', () => {
    // Arrange
    const state = {
      ...buildInitialNotificationChannelUido(),
      config: CONFIG,
      configLoading: true,
    }

    // Act
    const next = notificationChannelReducer(state, { type: 'CONFIG_REFRESH_FAILED' })

    // Assert
    expect(next.config).toEqual(CONFIG)
    expect(next.configError).toBeNull()
    expect(next.configLoading).toBe(false)
  })

  it('notificationChannelReducer_ShouldSayTheListeningInPlace_WhenItsFirstReadFails', () => {
    // Arrange
    const state = buildInitialNotificationChannelUido()

    // Act
    const next = notificationChannelReducer(state, {
      type: 'LISTENING_FAILED',
      error: SERVER_ERROR,
    })

    // Assert
    expect(next.listening).toBeNull()
    expect(next.listeningError).toEqual(SERVER_ERROR)
  })
})
