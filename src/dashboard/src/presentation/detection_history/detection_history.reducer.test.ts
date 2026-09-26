import { describe, expect, it } from 'vitest'
import { AppErrorKind } from '../../common/errors/app_error'
import { makeDetectionEvent } from '../../testing/detection_fixture'
import { detectionHistoryReducer } from './detection_history.reducer'
import { buildInitialDetectionHistoryUido } from './detection_history.uido'

const read = {
  ...buildInitialDetectionHistoryUido(),
  loaded: true,
  items: [makeDetectionEvent({ eventId: 'e1' }), makeDetectionEvent({ eventId: 'e2' })],
  nextCursor: 'cursor-1',
}

describe('detectionHistoryReducer', () => {
  it('detectionHistoryReducer_ShouldSayThereIsNoHistoryWithoutSurveillance_WhenSurveillanceIsDown', () => {
    // Arrange
    const error = { kind: AppErrorKind.SurveillanceDown }

    // Act
    const next = detectionHistoryReducer(read, { type: 'HISTORY_LOAD_FAILED', error })

    // Assert
    expect(next.error?.message).toBe(
      'La surveillance ne répond pas : tant qu’elle est arrêtée, il n’y a pas d’historique à afficher.',
    )
  })

  it('detectionHistoryReducer_ShouldSayTheHistoryCannotBeRead_WhenTheServerFails', () => {
    // Arrange
    const error = { kind: AppErrorKind.Server, status: 500 }

    // Act
    const next = detectionHistoryReducer(read, { type: 'HISTORY_LOAD_FAILED', error })

    // Assert
    expect(next.error?.message).toBe("Impossible de charger l'historique.")
  })

  it('detectionHistoryReducer_ShouldAddTheOlderPage_WhenMoreIsRead', () => {
    // Arrange
    const page = { items: [makeDetectionEvent({ eventId: 'e3' })], nextCursor: null }

    // Act
    const next = detectionHistoryReducer(read, { type: 'HISTORY_MORE_SUCCEEDED', page })

    // Assert
    expect(next.items.map((item) => item.eventId)).toEqual(['e1', 'e2', 'e3'])
    expect(next.nextCursor).toBeNull()
  })

  it('detectionHistoryReducer_ShouldReadAgainFromTheStart_WhenAFilterChanges', () => {
    // Arrange
    const action = { type: 'FILTER_LABEL_SET', value: 'car' } as const

    // Act
    const next = detectionHistoryReducer(read, action)

    // Assert
    expect(next).toMatchObject({ filterLabel: 'car', items: [], nextCursor: null, loaded: false })
  })

  it('detectionHistoryReducer_ShouldClearEveryFilter_WhenTheFiltersAreReset', () => {
    // Arrange
    const filtered = { ...read, filterCamera: 'garage', filterFrom: '2026-09-01' }

    // Act
    const next = detectionHistoryReducer(filtered, { type: 'FILTERS_RESET' })

    // Assert
    expect(next).toMatchObject({ filterCamera: '', filterFrom: '', items: [], loaded: false })
  })

  it('detectionHistoryReducer_ShouldNameOnlyTheCorrectedDetection_WhenTheCorrectionSucceeds', () => {
    // Arrange
    const correcting = { ...read, correctingEventId: 'e2' }

    // Act
    const next = detectionHistoryReducer(correcting, {
      type: 'CORRECT_SUCCEEDED',
      eventId: 'e2',
      identity: 'Alice',
      profileId: 'profile-1',
    })

    // Assert
    expect(next.items.map((item) => item.identity)).toEqual([null, 'Alice'])
    expect(next.correctingEventId).toBeNull()
  })
})
