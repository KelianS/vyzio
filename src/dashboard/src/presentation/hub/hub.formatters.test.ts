import { describe, expect, it } from 'vitest'
import { formatLastNotification, formatNotificationStatus } from './hub.formatters'

describe('hub formatters', () => {
  it('formatNotificationStatus_ShouldSayAlertsAreActiveWithoutNamingAChannel_WhenAChannelIsActive', () => {
    expect(formatNotificationStatus({ activeChannels: 2, sentCount: 1, lastSentAt: null })).toBe(
      'Alertes actives',
    )
  })

  it('formatNotificationStatus_ShouldSayThereIsNoChannel_WhenNoneIsActive', () => {
    expect(formatNotificationStatus({ activeChannels: 0, sentCount: 0, lastSentAt: null })).toBe(
      'Aucun canal d’alerte',
    )
  })

  it('formatLastNotification_ShouldSayNoneWasSent_WhenThereIsNoTimestamp', () => {
    expect(formatLastNotification(null)).toBe('Aucune alerte envoyee')
  })
})
