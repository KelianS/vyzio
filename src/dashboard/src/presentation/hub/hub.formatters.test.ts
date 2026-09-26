import { describe, expect, it } from 'vitest'
import { formatLastNotification, formatNotificationStatus } from './hub.formatters'

describe('hub formatters', () => {
  it('formatNotificationStatus_ShouldSayAlertsAreActiveWithoutNamingAChannel_WhenAChannelIsActive', () => {
    // Arrange & Act
    const label = formatNotificationStatus({ activeChannels: 2, sentCount: 1, lastSentAt: null })

    // Assert
    expect(label).toBe('Alertes actives')
  })

  it('formatNotificationStatus_ShouldSayThereIsNoChannel_WhenNoneIsActive', () => {
    // Arrange & Act
    const label = formatNotificationStatus({ activeChannels: 0, sentCount: 0, lastSentAt: null })

    // Assert
    expect(label).toBe('Aucun canal d’alerte')
  })

  it('formatLastNotification_ShouldSayNoneWasSent_WhenThereIsNoTimestamp', () => {
    // Arrange & Act
    const label = formatLastNotification(null)

    // Assert
    expect(label).toBe('Aucune alerte envoyee')
  })
})
