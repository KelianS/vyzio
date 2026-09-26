import { describe, expect, it } from 'vitest'
import { midnightRangeHint } from './midnight_range'

describe('midnightRangeHint', () => {
  it('midnightRangeHint_ShouldNameTheEndTime_WhenTheRangeCrossesMidnight', () => {
    // Arrange & Act
    const hint = midnightRangeHint('06:00')

    // Assert
    expect(hint).toBe('La plage passe minuit : elle se termine le lendemain à 06:00.')
  })
})
