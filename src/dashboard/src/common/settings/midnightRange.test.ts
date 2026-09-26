import { describe, expect, it } from 'vitest'
import { midnightRangeHint } from './midnightRange'

describe('midnightRangeHint', () => {
  it('midnightRangeHint_ShouldNameTheEndTime_WhenTheRangeCrossesMidnight', () => {
    expect(midnightRangeHint('06:00')).toBe(
      'La plage passe minuit : elle se termine le lendemain à 06:00.',
    )
  })
})
