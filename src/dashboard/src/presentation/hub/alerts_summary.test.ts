import { describe, expect, it } from 'vitest'
import { alertsSummary } from './alerts_summary'

describe('alertsSummary', () => {
  it('alertsSummary_ShouldSayNothingWasSentYet_WhenAChannelIsSetUpButQuiet', () => {
    // Arrange & Act
    const summary = alertsSummary({ activeChannels: 1, sentCount: 0, lastSentAt: null })

    // Assert
    expect(summary).toBe('Aucune alerte envoyée pour l’instant.')
  })

  it('alertsSummary_ShouldCountThemInThePlural_WhenSeveralWereSent', () => {
    // Arrange & Act
    const summary = alertsSummary({ activeChannels: 1, sentCount: 3, lastSentAt: null })

    // Assert
    expect(summary).toBe('3 envoyées')
  })

  it('alertsSummary_ShouldSayVyzioCannotWarn_WhenNoChannelIsSetUp', () => {
    // Arrange & Act
    const summary = alertsSummary({ activeChannels: 0, sentCount: 0, lastSentAt: null })

    // Assert
    expect(summary).toBe('Aucun canal configuré : Vyzio ne peut pas vous prévenir.')
  })
})
