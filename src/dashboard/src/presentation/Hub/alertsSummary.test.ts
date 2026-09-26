import { describe, expect, it } from 'vitest'
import { alertsSummary } from './alertsSummary'

describe('alertsSummary', () => {
  it('alertsSummary_ShouldSayNothingWasSentYet_WhenAChannelIsSetUpButQuiet', () => {
    expect(alertsSummary({ activeChannels: 1, sentCount: 0, lastSentAt: null })).toBe(
      'Aucune alerte envoyée pour l’instant.',
    )
  })

  it('alertsSummary_ShouldCountThemInThePlural_WhenSeveralWereSent', () => {
    expect(alertsSummary({ activeChannels: 1, sentCount: 3, lastSentAt: null })).toBe('3 envoyées')
  })

  it('alertsSummary_ShouldSayVyzioCannotWarn_WhenNoChannelIsSetUp', () => {
    expect(alertsSummary({ activeChannels: 0, sentCount: 0, lastSentAt: null })).toBe(
      'Aucun canal configuré : Vyzio ne peut pas vous prévenir.',
    )
  })
})
