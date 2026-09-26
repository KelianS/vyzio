import { describe, expect, it } from 'vitest'
import { latestOnly } from './latest_only'

describe('latestOnly', () => {
  it('latestOnly_ShouldLetTheCallAnswer_WhenNoLaterCallStarted', () => {
    // Arrange
    const next = latestOnly()

    // Act
    const isLatest = next()

    // Assert
    expect(isLatest()).toBe(true)
  })

  it('latestOnly_ShouldSilenceAnEarlierCall_WhenALaterCallStarted', () => {
    // Arrange
    const next = latestOnly()
    const earlier = next()

    // Act
    const later = next()

    // Assert
    expect(earlier()).toBe(false)
    expect(later()).toBe(true)
  })
})
