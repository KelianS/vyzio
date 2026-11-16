import { describe, expect, it } from 'vitest'
import { waitFor } from '@testing-library/react'
import { NavigationType } from 'react-router'
import { withFullMotion } from '../../testing/full_motion'
import { pageDirection, PageTransition } from './page_transition'

function shellParts() {
  const [stage, dim, row, plate, below] = Array.from({ length: 5 }, () =>
    document.createElement('div'),
  )
  return { stage, dim, row, plate, below }
}

describe('pageDirection', () => {
  it.each([
    [NavigationType.Push, 'forward'],
    [NavigationType.Pop, 'back'],
    [NavigationType.Replace, null],
  ])(
    'pageDirection_ShouldMoveThePagesOnlyForAPageChange_WhenTheRouterNavigates (%s)',
    (navigation, direction) => {
      // Arrange & Act
      const moved = pageDirection(navigation)

      // Assert
      expect(moved).toBe(direction)
    },
  )
})

describe('PageTransition', () => {
  it('barResized_ShouldGrowTheBarFromItsOldHeightWithThePageUnderIt_WhenAnAlertArrives', async () => {
    // Arrange
    withFullMotion()
    const parts = shellParts()
    const transition = new PageTransition()
    transition.attach(parts)

    // Act
    transition.barResized(40)

    // Assert
    expect(parts.plate.style.transform).toBe('translate3d(0px, -40px, 0px)')
    expect(parts.below.style.transform).toBe(parts.plate.style.transform)
    expect(parts.stage.style.transform).toBe(parts.plate.style.transform)
    await waitFor(() => expect(parts.plate.style.transform).toBe(''))
  })

  it('barResized_ShouldTakeTheNewHeightAtOnce_WhenThePhoneAsksForLessMotion', () => {
    // Arrange
    const parts = shellParts()
    const transition = new PageTransition()
    transition.attach(parts)

    // Act
    transition.barResized(40)

    // Assert
    expect(parts.plate.style.transform).toBe('')
  })
})
