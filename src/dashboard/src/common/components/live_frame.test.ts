import { describe, expect, it } from 'vitest'
import { liveWaitMessage } from './live_frame'

describe('liveWaitMessage', () => {
  it.each([
    { status: 'restarting', imageError: false, message: 'Redémarrage en cours…' },
    { status: 'restarting', imageError: true, message: 'Redémarrage en cours…' },
    { status: 'active', imageError: true, message: 'Reconnexion…' },
  ] as const)(
    'liveWaitMessage_ShouldSayWhyThePictureWaits_WhenSurveillanceIs$status (imageError: $imageError)',
    ({ status, imageError, message }) => {
      // Arrange & Act
      const said = liveWaitMessage(status, imageError)

      // Assert
      expect(said).toBe(message)
    },
  )

  it('liveWaitMessage_ShouldSayNothing_WhenThePictureShows', () => {
    // Arrange & Act
    const said = liveWaitMessage('active', false)

    // Assert
    expect(said).toBeNull()
  })
})
