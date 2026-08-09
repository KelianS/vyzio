import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { DetectionList } from './DetectionList'
import type { DetectionEvent } from '../../domain/entities/DetectionEvent'

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
  it('affiche le recadrage dans la tuile et ouvre le plan large', () => {
    const onOpenMedia = vi.fn()
    render(<DetectionList events={[event]} apiBaseUrl="http://api" onOpenMedia={onOpenMedia} />)

    expect(screen.getByRole('presentation')).toHaveAttribute(
      'src',
      'http://api/api/detection-events/evt-1/thumbnail',
    )

    fireEvent.click(screen.getByRole('button', { name: /Voir l’aperçu/ }))

    expect(onOpenMedia).toHaveBeenCalledWith(
      'image',
      'http://api/api/detection-events/evt-1/snapshot',
    )
  })

  it('dit qu’un média expiré est effacé, sans rien à cliquer', () => {
    const expired = { ...event, hasClip: true, mediaExpired: true }
    render(<DetectionList events={[expired]} apiBaseUrl="http://api" onOpenMedia={vi.fn()} />)

    expect(screen.getByText(/au-delà de la durée de conservation/i)).toBeInTheDocument()
    expect(screen.queryByRole('presentation')).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
