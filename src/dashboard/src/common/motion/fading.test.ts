import { describe, expect, it } from 'vitest'
import { fading } from './fading'

describe('fading', () => {
  it.each([true, false])(
    'fading_ShouldChangeOnlyOpacityAndVisibility_WhenTheControlsShowOrHide (shown: %s)',
    (shown) => {
      // Arrange & Act
      const fade = fading(shown)

      // Assert
      expect(fade.className).toMatch(/^transition-\[opacity,visibility\] /)
      expect(fade.className).not.toMatch(/translate|scale|rotate|blur/)
    },
  )

  it('fading_ShouldTakeTheControlsOutOfReach_WhenTheyAreHidden', () => {
    // Arrange & Act
    const fade = fading(false)

    // Assert
    expect(fade).toEqual(expect.objectContaining({ inert: true, 'aria-hidden': true }))
    expect(fade.className).toContain('opacity-0')
  })
})
