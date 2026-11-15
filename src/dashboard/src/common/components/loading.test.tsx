import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { Loading } from './loading'

describe('Loading', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('Loading_ShouldShowNothing_WhenTheReadAnswersWithinTheDelay', () => {
    // Arrange
    render(<Loading />)

    // Act
    act(() => vi.advanceTimersByTime(200))

    // Assert
    expect(screen.getByRole('status', { name: 'Chargement' })).toBeEmptyDOMElement()
  })

  it('Loading_ShouldShowTheShapeOfTheContent_WhenTheReadLastsLongerThanTheDelay', () => {
    // Arrange
    render(<Loading lines={2} />)

    // Act
    act(() => vi.advanceTimersByTime(300))

    // Assert
    expect(screen.getByRole('status', { name: 'Chargement' }).children).toHaveLength(2)
  })

  it('Loading_ShouldShowTheShapeItIsGiven_WhenTheContentIsNotALineList', () => {
    // Arrange
    render(
      <Loading>
        <div data-testid="frame" />
      </Loading>,
    )

    // Act
    act(() => vi.advanceTimersByTime(300))

    // Assert
    expect(screen.getByTestId('frame')).toBeInTheDocument()
  })
})
