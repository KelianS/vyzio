import { describe, expect, it } from 'vitest'
import { formatEventTitle } from './detectionFormatters'
import type { DetectionEvent } from '../../domain/entities/DetectionEvent'

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
    expect(formatEventTitle(event({ identity: 'Paul' }))).toBe('Paul')
  })

  it('formatEventTitle_ShouldNameTheDetectionInFrench_WhenNobodyWasRecognised', () => {
    expect(formatEventTitle(event({ identity: null, label: 'car' }))).toBe('Détection « car »')
  })
})
