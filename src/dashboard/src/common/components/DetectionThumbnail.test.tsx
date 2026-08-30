import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { DetectionThumbnail } from './DetectionThumbnail'

describe('DetectionThumbnail', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('montre un chargement tant que l’aperçu n’est pas arrivé', () => {
    render(<DetectionThumbnail src="/api/detection-events/e1/snapshot" />)

    expect(screen.getByRole('status', { name: 'Chargement de l’aperçu' })).toBeInTheDocument()
    // An image with no data shows the browser's broken icon: it stays hidden.
    expect(screen.getByRole('presentation')).toHaveClass('invisible')
  })

  it('retente de lui-même après un échec, sans recharger la page', () => {
    render(<DetectionThumbnail src="/api/detection-events/e1/snapshot" />)
    const image = screen.getByRole('presentation')

    fireEvent.error(image)
    expect(image).toHaveAttribute('src', '/api/detection-events/e1/snapshot')

    act(() => void vi.advanceTimersByTime(2000))

    // The browser caches the failure: the source must change to ask again.
    expect(screen.getByRole('presentation')).toHaveAttribute(
      'src',
      '/api/detection-events/e1/snapshot?retry=1',
    )
    expect(screen.getByRole('status', { name: 'Chargement de l’aperçu' })).toBeInTheDocument()
  })

  it('laisse redemander la main une fois les essais épuisés', () => {
    render(<DetectionThumbnail src="/api/detection-events/e1/snapshot" />)

    // Three spaced attempts, then the failure is settled.
    for (const delay of [2000, 5000, 10000, 0]) {
      fireEvent.error(screen.getByRole('presentation'))
      act(() => void vi.advanceTimersByTime(delay))
    }

    expect(
      screen.getByRole('button', { name: 'Réessayer de charger l’aperçu' }),
    ).toBeInTheDocument()
  })

  it('efface l’échec quand l’aperçu finit par arriver', () => {
    render(<DetectionThumbnail src="/api/detection-events/e1/snapshot" />)

    fireEvent.load(screen.getByRole('presentation'))

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getByRole('presentation')).not.toHaveClass('invisible')
  })
})
