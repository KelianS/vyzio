import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { DetectionList } from './detection_list'
import type { DetectionEvent } from '../../domain/entities/detection_event.entity'

const event: DetectionEvent = {
  eventId: 'evt-1',
  camera: 'jardin',
  cameraName: 'Jardin',
  label: 'person',
  identity: null,
  profileId: null,
  confidence: 0.78,
  occurredAt: '2026-08-09T10:00:00Z',
  hasClip: false,
  hasSnapshot: true,
  mediaExpired: false,
}

describe('DetectionList', () => {
  it('DetectionList_ShouldShowTheCrop_WhenTheEventHasAPreview', () => {
    // Arrange & Act
    render(<DetectionList events={[event]} apiBaseUrl="http://api" onOpenMedia={vi.fn()} />)

    // Assert
    expect(screen.getByRole('presentation')).toHaveAttribute(
      'src',
      'http://api/api/detection-events/evt-1/thumbnail',
    )
  })

  it('DetectionList_ShouldOpenTheWideShot_WhenTheUserOpensThePreview', () => {
    // Arrange
    const onOpenMedia = vi.fn()
    render(<DetectionList events={[event]} apiBaseUrl="http://api" onOpenMedia={onOpenMedia} />)

    // Act
    fireEvent.click(screen.getByRole('button', { name: /Voir l’aperçu/ }))

    // Assert
    expect(onOpenMedia).toHaveBeenCalledWith(
      'image',
      'http://api/api/detection-events/evt-1/snapshot',
    )
  })

  it('DetectionList_ShouldSayTheMediaIsErasedWithNothingToClick_WhenItExpired', () => {
    // Arrange & Act
    const expired = { ...event, hasClip: true, mediaExpired: true }
    render(<DetectionList events={[expired]} apiBaseUrl="http://api" onOpenMedia={vi.fn()} />)

    // Assert
    expect(screen.getByText(/au-delà de la durée de conservation/i)).toBeInTheDocument()
    expect(screen.queryByRole('presentation')).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
