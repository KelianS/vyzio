import { describe, expect, it } from 'vitest'
import { formatLastNotification, formatNotificationStatus } from './hub'

describe('hub formatters', () => {
  it('formats notification status for a configured telegram channel', () => {
    expect(formatNotificationStatus({ telegramConfigured: true, sentCount: 1, lastSentAt: null }))
      .toBe('Telegram actif')
  })

  it('formats missing notification timestamp with a friendly empty state', () => {
    expect(formatLastNotification(null)).toBe('Aucune alerte envoyee')
  })
})