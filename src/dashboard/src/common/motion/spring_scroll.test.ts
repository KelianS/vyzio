import { describe, expect, it } from 'vitest'
import { nearestScrollTop } from './spring_scroll'

describe('nearestScrollTop', () => {
  it.each([
    { where: 'under what sticks above', top: 100, bottom: 176, expected: 140 },
    { where: 'below the screen', top: 900, bottom: 976, expected: 576 },
  ])(
    'nearestScrollTop_ShouldScrollJustEnough_WhenTheRowIsHidden ($where)',
    ({ top, bottom, expected }) => {
      // Arrange & Act
      const scrollTop = nearestScrollTop({ top, bottom }, 360, 800, 400)

      // Assert
      expect(scrollTop).toBe(expected)
    },
  )

  it('nearestScrollTop_ShouldLeaveThePageWhereItIs_WhenTheRowAlreadyShowsWhole', () => {
    // Arrange & Act
    const scrollTop = nearestScrollTop({ top: 400, bottom: 476 }, 360, 800, 400)

    // Assert
    expect(scrollTop).toBeNull()
  })
})
