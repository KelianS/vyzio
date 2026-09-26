import { describe, expect, it } from 'vitest'
import { makeChannelConfig } from '../../testing/notification_fixture'
import {
  DEFAULT_NOTIFICATION_VALUES,
  toNotificationValues,
  toSaveRequest,
} from './notification_settings'

const credentials = makeChannelConfig().credentials

describe('toNotificationValues', () => {
  it('toNotificationValues_ShouldFallBackToTheDefaults_WhenTheChannelLeavesThemUnset', () => {
    // Arrange
    const config = makeChannelConfig({ allowedLabels: [], messageFields: [], mediaMode: undefined })

    // Act
    const values = toNotificationValues(config)

    // Assert
    expect(values).toMatchObject({
      allowedLabels: DEFAULT_NOTIFICATION_VALUES.allowedLabels,
      messageFields: DEFAULT_NOTIFICATION_VALUES.messageFields,
      mediaMode: 'clip_or_photo',
      restrictHours: false,
      fromHour: 8,
      toHour: 22,
      limitRepeats: false,
      cooldownMinutes: 5,
    })
  })

  it('toNotificationValues_ShouldShowTheRangeAndTheCooldown_WhenTheChannelHasThem', () => {
    // Arrange
    const config = makeChannelConfig({ activeFromHour: 22, activeToHour: 6, cooldownMinutes: 15 })

    // Act
    const values = toNotificationValues(config)

    // Assert
    expect(values).toMatchObject({
      restrictHours: true,
      fromHour: 22,
      toHour: 6,
      limitRepeats: true,
      cooldownMinutes: 15,
    })
  })

  it('toNotificationValues_ShouldShowTheStoredIdAndLeaveTheSecretEmpty_WhenTheChannelIsConfigured', () => {
    // Arrange
    const config = makeChannelConfig()

    // Act
    const values = toNotificationValues(config)

    // Assert
    expect(values).toMatchObject({ chat_id: '42', bot_token: '' })
  })

  it('toNotificationValues_ShouldShowTheCertaintyAsAPercentage_WhenTheChannelStoresAFraction', () => {
    // Arrange
    const config = makeChannelConfig({ minimumConfidence: 0.75 })

    // Act
    const values = toNotificationValues(config)

    // Assert
    expect(values.minimumConfidence).toBe(75)
  })
})

describe('toSaveRequest', () => {
  it('toSaveRequest_ShouldSendTheCertaintyAsAFraction_WhenTheScreenShowsAPercentage', () => {
    // Arrange
    const values = { ...DEFAULT_NOTIFICATION_VALUES, minimumConfidence: 60 }

    // Act
    const request = toSaveRequest(values, credentials)

    // Assert
    expect(request.minimumConfidence).toBe(0.6)
  })

  it('toSaveRequest_ShouldSendOnlyTheFilledCredentialsAndClearTheLimits_WhenTheLimitsAreOff', () => {
    // Arrange
    const values = { ...DEFAULT_NOTIFICATION_VALUES, bot_token: '  ', chat_id: ' 42 ' }

    // Act
    const request = toSaveRequest(values, credentials)

    // Assert
    expect(request).toMatchObject({
      credentials: { chat_id: '42' },
      activeFromHour: null,
      activeToHour: null,
      cooldownMinutes: undefined,
      clearCooldown: true,
    })
  })

  it('toSaveRequest_ShouldSendTheRangeAndTheCooldown_WhenTheLimitsAreOn', () => {
    // Arrange
    const values = {
      ...DEFAULT_NOTIFICATION_VALUES,
      restrictHours: true,
      fromHour: 22,
      toHour: 6,
      limitRepeats: true,
      cooldownMinutes: 15,
    }

    // Act
    const request = toSaveRequest(values, credentials)

    // Assert
    expect(request).toMatchObject({
      activeFromHour: 22,
      activeToHour: 6,
      cooldownMinutes: 15,
      clearCooldown: false,
    })
  })
})
