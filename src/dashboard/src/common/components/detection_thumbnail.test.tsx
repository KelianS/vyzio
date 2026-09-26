import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { DetectionThumbnail } from './detection_thumbnail'

describe('DetectionThumbnail', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('DetectionThumbnail_ShouldShowALoaderAndHideTheImage_WhenThePreviewHasNotArrived', () => {
    // Arrange & Act
    render(<DetectionThumbnail src="/api/detection-events/e1/snapshot" />)

    // Assert
    expect(screen.getByRole('status', { name: 'Chargement de l’aperçu' })).toBeInTheDocument()
    // An image with no data shows the browser's broken icon: it stays hidden.
    expect(screen.getByRole('presentation')).toHaveClass('invisible')
  })

  it('DetectionThumbnail_ShouldWaitBeforeRetrying_WhenThePreviewFails', () => {
    // Arrange
    render(<DetectionThumbnail src="/api/detection-events/e1/snapshot" />)
    const image = screen.getByRole('presentation')

    // Act
    fireEvent.error(image)

    // Assert
    expect(image).toHaveAttribute('src', '/api/detection-events/e1/snapshot')
  })

  it('DetectionThumbnail_ShouldRetryWithANewAddress_WhenThePreviewFails', () => {
    // Arrange
    render(<DetectionThumbnail src="/api/detection-events/e1/snapshot" />)
    fireEvent.error(screen.getByRole('presentation'))

    // Act
    act(() => void vi.advanceTimersByTime(2000))

    // Assert
    // The browser caches the failure: the source must change to ask again.
    expect(screen.getByRole('presentation')).toHaveAttribute(
      'src',
      '/api/detection-events/e1/snapshot?retry=1',
    )
    expect(screen.getByRole('status', { name: 'Chargement de l’aperçu' })).toBeInTheDocument()
  })

  it('DetectionThumbnail_ShouldOfferARetryButton_WhenEveryAttemptFailed', () => {
    // Arrange
    render(<DetectionThumbnail src="/api/detection-events/e1/snapshot" />)
    // Three spaced attempts, then the failure is settled.
    fireEvent.error(screen.getByRole('presentation'))
    act(() => void vi.advanceTimersByTime(2000))
    fireEvent.error(screen.getByRole('presentation'))
    act(() => void vi.advanceTimersByTime(5000))
    fireEvent.error(screen.getByRole('presentation'))
    act(() => void vi.advanceTimersByTime(10000))

    // Act
    fireEvent.error(screen.getByRole('presentation'))
    act(() => void vi.advanceTimersByTime(0))

    // Assert
    expect(
      screen.getByRole('button', { name: 'Réessayer de charger l’aperçu' }),
    ).toBeInTheDocument()
  })

  it('DetectionThumbnail_ShouldShowThePreview_WhenItFinallyLoads', () => {
    // Arrange
    render(<DetectionThumbnail src="/api/detection-events/e1/snapshot" />)

    // Act
    fireEvent.load(screen.getByRole('presentation'))

    // Assert
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getByRole('presentation')).not.toHaveClass('invisible')
  })
})
