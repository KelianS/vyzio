import { describe, expect, it } from 'vitest'
import {
  clipFileName,
  formatClipDay,
  formatClipDetail,
  formatEventTitle,
} from './detection_formatters'
import type { DetectionEvent } from '../../domain/entities/detection_event.entity'

const event = (overrides: Partial<DetectionEvent>): DetectionEvent => ({
  eventId: 'e1',
  camera: 'porte_entree',
  cameraName: 'Porte d’entrée',
  label: 'person',
  identity: null,
  profileId: null,
  confidence: 0.9,
  occurredAt: '2026-09-26T18:00:00Z',
  hasClip: false,
  hasSnapshot: true,
  mediaExpired: false,
  ...overrides,
})

describe('formatEventTitle', () => {
  it('formatEventTitle_ShouldShowTheNameAlone_WhenTheEventCarriesAnIdentity', () => {
    // Arrange & Act
    const title = formatEventTitle(event({ identity: 'Paul' }), [])

    // Assert
    expect(title).toBe('Paul')
  })

  it('formatEventTitle_ShouldNameTheDetectionInFrench_WhenTheCatalogueKnowsItsLabel', () => {
    // Arrange
    const labels = [{ value: 'car', displayName: 'Voiture' }]

    // Act
    const title = formatEventTitle(event({ identity: null, label: 'car' }), labels)

    // Assert
    expect(title).toBe('Détection « Voiture »')
  })

  it('formatEventTitle_ShouldKeepTheEngineLabel_WhenTheCatalogueDoesNotKnowIt', () => {
    // Arrange & Act
    const title = formatEventTitle(event({ identity: null, label: 'car' }), [])

    // Assert
    expect(title).toBe('Détection « car »')
  })
})

describe('formatClipDay', () => {
  it.each([
    { occurredAt: '2026-11-16T09:00:00', said: 'Aujourd’hui' },
    { occurredAt: '2026-11-15T23:30:00', said: 'Hier' },
    { occurredAt: '2026-11-12T10:00:00', said: 'Jeudi 12 novembre' },
  ])('formatClipDay_ShouldNameTheDayAClipHappened_WhenItIs ($said)', ({ occurredAt, said }) => {
    // Arrange & Act
    const day = formatClipDay(occurredAt, new Date('2026-11-16T18:00:00'))

    // Assert
    expect(day).toBe(said)
  })
})

describe('formatClipDetail', () => {
  it.each([
    {
      occurredAt: '2026-11-16T17:46:00',
      confidence: 0.92,
      said: '17\u00a0h\u00a046 · sûr\u00a0à\u00a092\u00a0%',
    },
    { occurredAt: '2026-11-16T08:00:00', confidence: null, said: '8\u00a0h' },
  ])(
    'formatClipDetail_ShouldSayTheHourAndHowSure_WhenTheEngineSaidIt ($said)',
    ({ occurredAt, confidence, said }) => {
      // Arrange & Act
      const detail = formatClipDetail(event({ occurredAt, confidence }))

      // Assert
      expect(detail).toBe(said)
    },
  )
})

describe('formatClipDetail with its camera', () => {
  it('formatClipDetail_ShouldPutTheCameraFirst_WhenTheListMixesCameras', () => {
    // Arrange & Act
    const detail = formatClipDetail(
      event({ occurredAt: '2026-11-16T17:46:00', confidence: 0.92 }),
      true,
    )

    // Assert
    expect(detail).toBe('Porte d’entrée · 17\u00a0h\u00a046 · sûr\u00a0à\u00a092\u00a0%')
  })
})

describe('clipFileName', () => {
  it('clipFileName_ShouldNameTheFileAfterItsCameraAndMoment_WhenAClipIsDownloaded', () => {
    // Arrange & Act
    const name = clipFileName(event({ occurredAt: '2026-11-16T07:05:00' }))

    // Assert
    expect(name).toBe('Porte d’entrée 2026-11-16 07h05.mp4')
  })
})
