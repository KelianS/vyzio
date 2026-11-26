import { describe, expect, it } from 'vitest'
import { AppErrorKind } from '../../common/errors/app_error'
import { makeDetectionEvent } from '../../testing/detection_fixture'
import { detectionHistoryReducer, historyFailureSubject } from './detection_history.reducer'
import { buildInitialDetectionHistoryUido } from './detection_history.uido'

const read = {
  ...buildInitialDetectionHistoryUido(),
  loaded: true,
  items: [
    makeDetectionEvent({ eventId: 'e1' }),
    makeDetectionEvent({ eventId: 'e2' }),
    makeDetectionEvent({ eventId: 'e3' }),
  ],
  nextCursor: 'cursor-1',
}

describe('historyFailureSubject', () => {
  it('historyFailureSubject_ShouldSayThereIsNothingToShowWithoutSurveillance_WhenSurveillanceIsDown', () => {
    // Arrange & Act
    const subject = historyFailureSubject({ kind: AppErrorKind.SurveillanceDown })

    // Assert
    expect(subject).toBe(
      'La surveillance ne répond pas : tant qu’elle est arrêtée, il n’y a pas de détection à afficher.',
    )
  })

  it('historyFailureSubject_ShouldSayTheDetectionsCannotBeRead_WhenTheServerFails', () => {
    // Arrange & Act
    const subject = historyFailureSubject({ kind: AppErrorKind.Server, status: 500 })

    // Assert
    expect(subject).toBe('Les détections n’ont pas pu être lues.')
  })
})

describe('detectionHistoryReducer', () => {
  it('detectionHistoryReducer_ShouldAddTheOlderPage_WhenMoreIsRead', () => {
    // Arrange
    const page = { items: [makeDetectionEvent({ eventId: 'e4' })], nextCursor: null }

    // Act
    const next = detectionHistoryReducer(read, { type: 'HISTORY_MORE_SUCCEEDED', page })

    // Assert
    expect(next.items.map((item) => item.eventId)).toEqual(['e1', 'e2', 'e3', 'e4'])
    expect(next.nextCursor).toBeNull()
  })

  it('detectionHistoryReducer_ShouldReadAgainFromTheStartAndKeepTheSheetOpen_WhenAValueIsChecked', () => {
    // Arrange
    const filtering = {
      ...read,
      sheet: 'filter' as const,
      playingId: 'e2',
      filters: { camera: [], profile: [], label: ['cat'] },
    }

    // Act
    const next = detectionHistoryReducer(filtering, {
      type: 'FILTER_TOGGLED',
      axis: 'label',
      value: 'car',
    })

    // Assert
    expect(next).toMatchObject({
      filters: { camera: [], profile: [], label: ['cat', 'car'] },
      items: [],
      nextCursor: null,
      loaded: false,
      playingId: null,
      sheet: 'filter',
    })
  })

  it('detectionHistoryReducer_ShouldUncheckTheValue_WhenItIsTappedAgain', () => {
    // Arrange
    const filtering = {
      ...read,
      filters: { camera: ['camera-1', 'camera-2'], profile: [], label: [] },
    }

    // Act
    const next = detectionHistoryReducer(filtering, {
      type: 'FILTER_TOGGLED',
      axis: 'camera',
      value: 'camera-1',
    })

    // Assert
    expect(next.filters.camera).toEqual(['camera-2'])
  })

  it('detectionHistoryReducer_ShouldShowEveryValueOfTheAxisOnly_WhenItsAllRowIsTapped', () => {
    // Arrange
    const filtering = {
      ...read,
      filters: { camera: ['camera-1'], profile: ['profile-1'], label: [] },
    }

    // Act
    const next = detectionHistoryReducer(filtering, { type: 'FILTER_CLEARED', axis: 'camera' })

    // Assert
    expect(next.filters).toEqual({ camera: [], profile: ['profile-1'], label: [] })
  })

  it('detectionHistoryReducer_ShouldClearEveryFilterAndTheDay_WhenTheFiltersAreReset', () => {
    // Arrange
    const filtered = {
      ...read,
      filters: { camera: ['camera-2'], profile: ['profile-1'], label: ['car'] },
      filterDay: { kind: 'yesterday' as const },
    }

    // Act
    const next = detectionHistoryReducer(filtered, { type: 'FILTERS_RESET' })

    // Assert
    expect(next).toMatchObject({
      filters: { camera: [], profile: [], label: [] },
      filterDay: { kind: 'any' },
      items: [],
      loaded: false,
    })
  })

  it('detectionHistoryReducer_ShouldPlayTheNextClip_WhenTheOneInThePlayerEnds', () => {
    // Arrange
    const playing = { ...read, playingId: 'e1' }

    // Act
    const next = detectionHistoryReducer(playing, { type: 'CLIP_ENDED', eventId: 'e1' })

    // Assert
    expect(next.playingId).toBe('e2')
  })

  it('detectionHistoryReducer_ShouldSayTheClipStartedOnItsOwn_WhenTheOneBeforeItEnds', () => {
    // Arrange
    const playing = { ...read, playingId: 'e1' }

    // Act
    const next = detectionHistoryReducer(playing, { type: 'CLIP_ENDED', eventId: 'e1' })

    // Assert
    expect(next.playedOnItsOwn).toBe(true)
  })

  it('detectionHistoryReducer_ShouldSayTheClipWasChosen_WhenTheUserTapsARowAfterAClipStartedOnItsOwn', () => {
    // Arrange
    const followed = { ...read, playingId: 'e2', playedOnItsOwn: true }

    // Act
    const next = detectionHistoryReducer(followed, { type: 'CLIP_PLAYED', eventId: 'e1' })

    // Assert
    expect(next.playedOnItsOwn).toBe(false)
  })

  it('detectionHistoryReducer_ShouldStayOnTheLastClip_WhenTheLastOneEnds', () => {
    // Arrange
    const playing = { ...read, playingId: 'e3' }

    // Act
    const next = detectionHistoryReducer(playing, { type: 'CLIP_ENDED', eventId: 'e3' })

    // Assert
    expect(next.playingId).toBe('e3')
  })

  it.each(['actions', 'identity'] as const)(
    'detectionHistoryReducer_ShouldHoldTheClip_WhenItEndsWhileItsActionsAreOpen (%s)',
    (sheet) => {
      // Arrange
      const acting = { ...read, playingId: 'e1', sheet }

      // Act
      const next = detectionHistoryReducer(acting, { type: 'CLIP_ENDED', eventId: 'e1' })

      // Assert
      expect(next.playingId).toBe('e1')
    },
  )

  it('detectionHistoryReducer_ShouldNameOnlyTheCorrectedDetection_WhenTheCorrectionSucceeds', () => {
    // Arrange & Act
    const next = detectionHistoryReducer(read, {
      type: 'CORRECT_SUCCEEDED',
      eventId: 'e2',
      identity: 'Alice',
      profileId: 'profile-1',
    })

    // Assert
    expect(next.items.map((item) => item.identity)).toEqual([null, 'Alice', null])
  })

  it('detectionHistoryReducer_ShouldDropTheDeletedClipAndPlayTheNext_WhenThePlayingOneIsDeleted', () => {
    // Arrange
    const deleting = { ...read, playingId: 'e2', deletingEventId: 'e2' }

    // Act
    const next = detectionHistoryReducer(deleting, { type: 'DELETE_SUCCEEDED', eventId: 'e2' })

    // Assert
    expect(next.items.map((item) => item.eventId)).toEqual(['e1', 'e3'])
    expect(next.deletingEventId).toBeNull()
    expect(next.playingId).toBe('e3')
  })

  it('detectionHistoryReducer_ShouldKeepThePlayingClip_WhenAnotherOneIsDeleted', () => {
    // Arrange
    const deleting = { ...read, playingId: 'e1', deletingEventId: 'e3' }

    // Act
    const next = detectionHistoryReducer(deleting, { type: 'DELETE_SUCCEEDED', eventId: 'e3' })

    // Assert
    expect(next.playingId).toBe('e1')
  })
})
