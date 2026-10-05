import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LiveVideo } from './live_video'

describe('LiveVideo', () => {
  it('LiveVideo_ShouldGoBackToTheOfferedQuality_WhenTheCameraStopsOfferingTheWatchedOne', () => {
    // Arrange
    const onChooseQuality = vi.fn()

    // Act
    render(
      <LiveVideo
        cameraId="camera-1"
        apiBaseUrl=""
        label="Front Door"
        frigateStatus="active"
        quality="high"
        qualities={['low']}
        soundOn={false}
        onOpen={() => () => undefined}
        onChooseQuality={onChooseQuality}
        onToggleSound={vi.fn()}
      />,
    )

    // Assert
    expect(onChooseQuality).toHaveBeenCalledWith('low')
  })

  it('LiveVideo_ShouldOfferTheOtherQualityAndNoRetry_WhenTheWatchedQualityIsNoLongerOffered', () => {
    // Arrange & Act
    render(
      <LiveVideo
        cameraId="camera-1"
        apiBaseUrl=""
        label="Front Door"
        frigateStatus="active"
        quality="high"
        qualities={['low', 'high']}
        soundOn={false}
        onOpen={(_video, _camera, _quality, _sound, onPlayback) => {
          onPlayback({
            kind: 'failed',
            failure: 'no_quality',
            diagnostic: 'live camera-1 high: close 4422',
          })
          return () => undefined
        }}
        onChooseQuality={vi.fn()}
        onToggleSound={vi.fn()}
      />,
    )

    // Assert
    expect(
      screen.getByText('Cette qualité n’est plus proposée : image rafraîchie chaque seconde.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Haute qualité' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Réessayer' })).not.toBeInTheDocument()
  })
})
