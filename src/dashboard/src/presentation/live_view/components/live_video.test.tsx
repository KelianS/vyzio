import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import type { LivePlayback } from '../../../domain/entities/live_playback.entity'
import type { FrigateStatus } from '../../../domain/entities/system_stats.entity'
import { LiveVideo } from './live_video'

const CAMERA_LOST = 'Cette caméra ne répond plus : la vidéo reprendra dès son retour.'
const STALLED: LivePlayback = { kind: 'stalled', diagnostic: 'live camera-1 low: no video for 5 s' }
const STILL_AWAY: LivePlayback = {
  kind: 'failed',
  failure: 'unreachable',
  diagnostic: 'live camera-1 low: close 4503 stream_unreachable',
}
const PLAYING: LivePlayback = { kind: 'playing', soundOffered: false }

// Each opening of the stream, with the callback through which the test plays the player.
function renderWatched(frigateStatus: FrigateStatus = 'active') {
  const openings: ((playback: LivePlayback) => void)[] = []
  render(
    <LiveVideo
      cameraId="camera-1"
      apiBaseUrl=""
      label="Front Door"
      frigateStatus={frigateStatus}
      quality="low"
      qualities={['low']}
      soundOn={false}
      layout="portrait"
      bar={() => null}
      onOpen={(_video, _camera, _quality, _sound, onPlayback) => {
        openings.push(onPlayback)
        return () => undefined
      }}
      onChooseQuality={vi.fn()}
      onToggleSound={vi.fn()}
    />,
  )
  const play = (playback: LivePlayback) => act(() => openings.at(-1)?.(playback))
  return { openings, play }
}

afterEach(() => {
  vi.useRealTimers()
})

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
        layout="portrait"
        bar={() => null}
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
        layout="portrait"
        bar={() => null}
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
    expect(screen.getByRole('button', { name: 'HD haute qualité' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Réessayer' })).not.toBeInTheDocument()
  })

  it('LiveVideo_ShouldSayTheCameraNoLongerAnswersWithoutAPicture_WhenThePlayerStalls', () => {
    // Arrange
    const { play } = renderWatched()
    play(PLAYING)

    // Act
    play(STALLED)

    // Assert
    expect(screen.getByText(CAMERA_LOST)).toBeInTheDocument()
    expect(screen.getByText('live camera-1 low: no video for 5 s')).toBeInTheDocument()
    expect(screen.getByLabelText('Front Door', { selector: 'video' })).toHaveClass('invisible')
    expect(screen.queryByRole('img', { name: 'Front Door' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Réessayer' })).not.toBeInTheDocument()
  })

  it('LiveVideo_ShouldKeepTheSentenceThroughTheAttempts_WhenTheCameraIsStillAway', () => {
    // Arrange
    vi.useFakeTimers()
    const { openings, play } = renderWatched()
    play(PLAYING)
    play(STALLED)

    // Act
    act(() => vi.advanceTimersByTime(2000))
    const reopened = openings.length
    const connectingSaid = screen.queryByText('Connexion…')
    play(STILL_AWAY)

    // Assert
    expect(reopened).toBe(2)
    expect(connectingSaid).toBeNull()
    expect(screen.getByText(CAMERA_LOST)).toBeInTheDocument()
    expect(
      screen.queryByText('La vidéo n’arrive pas : image rafraîchie chaque seconde.'),
    ).not.toBeInTheDocument()
  })

  it('LiveVideo_ShouldWaitLongerBeforeTheNextAttempt_WhenTheCameraIsStillAway', () => {
    // Arrange
    vi.useFakeTimers()
    const { openings, play } = renderWatched()
    play(PLAYING)
    play(STALLED)
    act(() => vi.advanceTimersByTime(2000))
    play(STILL_AWAY)

    // Act
    act(() => vi.advanceTimersByTime(3999))
    const beforeTheDelay = openings.length
    act(() => vi.advanceTimersByTime(1))

    // Assert
    expect(beforeTheDelay).toBe(2)
    expect(openings).toHaveLength(3)
  })

  it('LiveVideo_ShouldTryAgainEveryFifteenSecondsAtMost_WhenTheCameraStaysAway', () => {
    // Arrange
    vi.useFakeTimers()
    const { openings, play } = renderWatched()
    play(PLAYING)
    play(STALLED)
    act(() => vi.advanceTimersByTime(2000))
    play(STILL_AWAY)
    act(() => vi.advanceTimersByTime(4000))
    play(STILL_AWAY)
    act(() => vi.advanceTimersByTime(8000))
    play(STILL_AWAY)

    // Act
    act(() => vi.advanceTimersByTime(14_999))
    const beforeTheCeiling = openings.length
    act(() => vi.advanceTimersByTime(1))

    // Assert
    expect(beforeTheCeiling).toBe(4)
    expect(openings).toHaveLength(5)
  })

  it('LiveVideo_ShouldResumeOnItsOwn_WhenTheCameraAnswersAgain', () => {
    // Arrange
    vi.useFakeTimers()
    const { play } = renderWatched()
    play(PLAYING)
    play(STALLED)
    act(() => vi.advanceTimersByTime(2000))

    // Act
    play(PLAYING)

    // Assert
    expect(screen.queryByText(CAMERA_LOST)).not.toBeInTheDocument()
    expect(screen.getByLabelText('Front Door', { selector: 'video' })).not.toHaveClass('invisible')
  })

  it('LiveVideo_ShouldSayPrivacyMode_WhenTheCameraComesBackInPrivacyMode', () => {
    // Arrange
    vi.useFakeTimers()
    const { play } = renderWatched()
    play(PLAYING)
    play(STALLED)
    act(() => vi.advanceTimersByTime(2000))

    // Act
    play({ kind: 'failed', failure: 'privacy', diagnostic: 'live camera-1 low: close 4409' })

    // Assert
    expect(screen.getByText('Mode vie privée : la vue en direct est arrêtée.')).toBeInTheDocument()
    expect(screen.queryByText(CAMERA_LOST)).not.toBeInTheDocument()
  })

  it('LiveVideo_ShouldSaySurveillanceRestarts_WhenTheStreamStallsDuringARestart', () => {
    // Arrange
    const { play } = renderWatched('restarting')
    play(PLAYING)

    // Act
    play(STALLED)

    // Assert
    expect(screen.getByText('Redémarrage en cours…')).toBeInTheDocument()
    expect(screen.queryByText(CAMERA_LOST)).not.toBeInTheDocument()
  })
})
