import { describe, expect, it } from 'vitest'
import { recentDetectionsLine } from './home_wording'

describe('recentDetectionsLine', () => {
  it.each([
    { recent: null, said: null },
    { recent: { count: 0, more: false }, said: null },
    { recent: { count: 2, more: false }, said: '2 depuis 1 h' },
    { recent: { count: 100, more: true }, said: '100+ depuis 1 h' },
  ])(
    'recentDetectionsLine_ShouldCountOnlyWhatWasSeen_WhenTheLastHourIsRead ($said)',
    ({ recent, said }) => {
      // Arrange & Act
      const text = recentDetectionsLine(recent)

      // Assert
      expect(text).toBe(said)
    },
  )
})
