import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { makeDetectionEvent } from '../../testing/detection_fixture'
import { ClipPlayer } from './clip_player'

const CAT = makeDetectionEvent({ eventId: 'event-1', label: 'cat', hasClip: true })

/** A clip in the player, with one control the screen lays over it. */
function aPlayingClip() {
  render(
    <ClipPlayer
      event={CAT}
      labels={[{ value: 'cat', displayName: 'Chat' }]}
      apiBaseUrl=""
      clipGone={false}
      onVideoError={() => {}}
    >
      <button type="button">Plus d’actions</button>
    </ClipPlayer>,
  )
  const video = screen.getByLabelText('Chat')
  fireEvent.play(video)
  fireEvent.playing(video)
  return video
}

function wait(ms: number) {
  act(() => vi.advanceTimersByTime(ms))
}

describe('ClipPlayer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('ClipPlayer_ShouldFadeItsControlsAndCaption_WhenTheClipPlaysThreeSecondsUntouched', () => {
    // Arrange
    aPlayingClip()

    // Act
    wait(3000)

    // Assert
    expect(screen.queryByRole('button', { name: 'Pause' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Plus d’actions' })).not.toBeInTheDocument()
    expect(screen.getByText('Chat', { selector: 'p' }).closest('[inert]')).not.toBeNull()
  })

  it('ClipPlayer_ShouldKeepItsProgressLine_WhenTheControlsHaveFaded', () => {
    // Arrange
    aPlayingClip()

    // Act
    wait(3000)

    // Assert
    const progress = screen.getByRole('group').querySelector('[style]')
    expect(progress).toHaveStyle({ width: '0%' })
    expect(progress!.closest('[inert]')).toBeNull()
  })

  it('ClipPlayer_ShouldKeepItsControls_WhenLessThanThreeSecondsHavePassed', () => {
    // Arrange
    aPlayingClip()

    // Act
    wait(2999)

    // Assert
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument()
  })

  it('ClipPlayer_ShouldBringItsControlsBack_WhenTheUserTapsTheVideo', () => {
    // Arrange
    const video = aPlayingClip()
    wait(3000)

    // Act
    fireEvent.pointerDown(video)
    fireEvent.pointerUp(video)

    // Assert
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Plus d’actions' })).toBeInTheDocument()
  })

  it('ClipPlayer_ShouldFadeAgainThreeSecondsLater_WhenTheUserTappedTheVideo', () => {
    // Arrange
    const video = aPlayingClip()
    wait(3000)
    fireEvent.pointerDown(video)
    fireEvent.pointerUp(video)

    // Act
    wait(3000)

    // Assert
    expect(screen.queryByRole('button', { name: 'Pause' })).not.toBeInTheDocument()
  })

  it('ClipPlayer_ShouldBringItsControlsBack_WhenAKeyMovesTheKeyboardFocus', () => {
    // Arrange
    aPlayingClip()
    wait(3000)

    // Act
    fireEvent.keyDown(window, { key: 'Tab' })

    // Assert
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument()
  })

  it('ClipPlayer_ShouldBringItsControlsBack_WhenTheKeyboardFocusReachesAControl', () => {
    // Arrange
    aPlayingClip()
    wait(3000)

    // Act
    act(() => screen.getByText('Plus d’actions').focus())

    // Assert
    expect(screen.getByRole('button', { name: 'Plus d’actions' })).toHaveFocus()
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument()
  })

  it('ClipPlayer_ShouldKeepItsControls_WhenAFingerHoldsOneOfThem', () => {
    // Arrange
    aPlayingClip()
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Plus d’actions' }))

    // Act
    wait(5000)

    // Assert
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Plus d’actions' })).toBeInTheDocument()
  })

  it('ClipPlayer_ShouldFadeNothing_WhenTheDetectionHasNoVideo', () => {
    // Arrange
    render(
      <ClipPlayer
        event={makeDetectionEvent({ label: 'cat', hasSnapshot: true })}
        labels={[{ value: 'cat', displayName: 'Chat' }]}
        apiBaseUrl=""
        clipGone={false}
        onVideoError={() => {}}
      >
        <button type="button">Plus d’actions</button>
      </ClipPlayer>,
    )

    // Act
    wait(3000)

    // Assert
    expect(screen.getByRole('button', { name: 'Plus d’actions' })).toBeInTheDocument()
    expect(screen.getByText('Chat', { selector: 'p' }).closest('[inert]')).toBeNull()
  })

  it('ClipPlayer_ShouldKeepItsControls_WhenTheClipIsPaused', () => {
    // Arrange
    const video = aPlayingClip()
    fireEvent.pause(video)

    // Act
    wait(3000)

    // Assert
    expect(screen.getByRole('button', { name: 'Lire' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Plus d’actions' })).toBeInTheDocument()
  })

  it('ClipPlayer_ShouldKeepItsControls_WhenTheClipWaitsForItsData', () => {
    // Arrange
    const video = aPlayingClip()
    fireEvent.waiting(video)

    // Act
    wait(3000)

    // Assert
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Plus d’actions' })).toBeInTheDocument()
  })

  it('ClipPlayer_ShouldFadeItsControls_WhenTheClipStallsButPlaysOnFromItsBuffer', () => {
    // Arrange
    const video = aPlayingClip()
    fireEvent.stalled(video)

    // Act
    wait(3000)

    // Assert
    expect(screen.queryByRole('button', { name: 'Pause' })).not.toBeInTheDocument()
  })

  it('ClipPlayer_ShouldFadeItsControls_WhenTheClipPlaysThreeSecondsAgainAfterWaiting', () => {
    // Arrange
    const video = aPlayingClip()
    fireEvent.waiting(video)
    fireEvent.playing(video)

    // Act
    wait(3000)

    // Assert
    expect(screen.queryByRole('button', { name: 'Pause' })).not.toBeInTheDocument()
  })

  it('ClipPlayer_ShouldKeepItsControls_WhenTheClipHasEnded', () => {
    // Arrange
    const video = aPlayingClip()
    fireEvent.ended(video)

    // Act
    wait(3000)

    // Assert
    expect(screen.getByRole('button', { name: 'Plus d’actions' })).toBeInTheDocument()
    expect(screen.getByText('Chat', { selector: 'p' }).closest('[inert]')).toBeNull()
  })
})
