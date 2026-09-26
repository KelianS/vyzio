import { describe, expect, it } from 'vitest'
import { formatLastNotification, formatNotificationStatus } from './hub.formatters'

describe('hub formatters', () => {
  it('formats notification status without naming any channel', () => {
    expect(formatNotificationStatus({ activeChannels: 2, sentCount: 1, lastSentAt: null })).toBe(
      'Alertes actives',
    )
  })

  it('formats notification status when no channel is active', () => {
    expect(formatNotificationStatus({ activeChannels: 0, sentCount: 0, lastSentAt: null })).toBe(
      'Aucun canal d’alerte',
    )
  })

  it('formats missing notification timestamp with a friendly empty state', () => {
    expect(formatLastNotification(null)).toBe('Aucune alerte envoyee')
  })
})
