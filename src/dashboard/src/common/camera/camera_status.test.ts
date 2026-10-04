import { describe, expect, it } from 'vitest'
import { makeCamera } from '../../testing/camera_fixture'
import {
  SurveillanceEntry,
  formatCameraStatusLabel,
  formatStatusTone,
  surveillanceEntryOf,
} from './camera_status'

describe('formatCameraStatusLabel', () => {
  it('formatCameraStatusLabel_ShouldWriteItInFrenchWithItsAccents_WhenTheCameraIsOnline', () => {
    // Arrange & Act
    const label = formatCameraStatusLabel(makeCamera({ status: 'online' }))

    // Assert
    expect(label).toBe('Connectée')
  })

  it('formatCameraStatusLabel_ShouldAskToCheck_WhenTheStatusIsUnknown', () => {
    // Arrange & Act
    const label = formatCameraStatusLabel(makeCamera({ status: 'something_new' }))

    // Assert
    expect(label).toBe('À vérifier')
  })

  it('formatCameraStatusLabel_ShouldSayItIsToSetUp_WhenItsStreamNeverWorked', () => {
    // Arrange & Act
    const label = formatCameraStatusLabel(
      makeCamera({ status: 'to_set_up', validationState: 'to_set_up' }),
    )

    // Assert
    expect(label).toBe('À configurer')
  })

  it('formatCameraStatusLabel_ShouldSayItIsNotWatchedYet_WhenItsStreamWorksButSurveillanceHasNotTakenItIn', () => {
    // Arrange & Act
    const label = formatCameraStatusLabel(
      makeCamera({ status: 'online', validationState: 'draft' }),
    )

    // Assert
    expect(label).toBe('Pas encore surveillée')
  })

  it.each([
    { status: 'offline', label: 'Hors ligne' },
    { status: 'degraded', label: 'Dégradée' },
    { status: 'config_error', label: 'Erreur de configuration' },
  ])(
    'formatCameraStatusLabel_ShouldNameTheTrouble_WhenTheCameraIsNotOnline ($status)',
    ({ status, label }) => {
      // Arrange & Act
      const said = formatCameraStatusLabel(makeCamera({ status }))

      // Assert
      expect(said).toBe(label)
    },
  )
})

describe('formatStatusTone', () => {
  it.each([
    { status: 'online', needsAttention: false, tone: 'ok' },
    { status: 'online', needsAttention: true, tone: 'warn' },
    { status: 'offline', needsAttention: false, tone: 'danger' },
    { status: 'degraded', needsAttention: false, tone: 'warn' },
    { status: 'to_set_up', needsAttention: true, tone: 'neutral' },
  ])(
    'formatStatusTone_ShouldColourTheBadgeByHowTheCameraIs_WhenItReportsItsStatus ($status, attention: $needsAttention)',
    ({ status, needsAttention, tone }) => {
      // Arrange & Act
      const said = formatStatusTone(makeCamera({ status, needsAttention }))

      // Assert
      expect(said).toBe(tone)
    },
  )
})

describe('formatStatusTone (waiting for the restart)', () => {
  it('formatStatusTone_ShouldStayNeutral_WhenTheCameraWaitsForTheRestart', () => {
    // Arrange & Act
    const said = formatStatusTone(
      makeCamera({ status: 'online', validationState: 'draft', needsAttention: true }),
    )

    // Assert
    expect(said).toBe('neutral')
  })
})

describe('surveillanceEntryOf', () => {
  it.each([
    { validationState: 'to_set_up', entry: SurveillanceEntry.AwaitsStream },
    { validationState: 'draft', entry: SurveillanceEntry.AwaitsRestart },
    { validationState: 'validated', entry: SurveillanceEntry.Watched },
  ])(
    'surveillanceEntryOf_ShouldSayWhatTheCameraWaitsFor_WhenItStandsThere ($validationState)',
    ({ validationState, entry }) => {
      // Arrange & Act
      const said = surveillanceEntryOf(makeCamera({ validationState }))

      // Assert
      expect(said).toBe(entry)
    },
  )
})
