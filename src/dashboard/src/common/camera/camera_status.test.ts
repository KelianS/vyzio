import { describe, expect, it } from 'vitest'
import { makeCamera } from '../../testing/camera_fixture'
import { SurveillanceEntry, cameraMark, surveillanceEntryOf } from './camera_status'

describe('cameraMark', () => {
  it('cameraMark_ShouldShowTheGreenDot_WhenTheCameraIsWatchedAndFilms', () => {
    // Arrange & Act
    const mark = cameraMark(makeCamera({ status: 'online' }))

    // Assert
    expect(mark).toEqual({ kind: 'on', label: 'En marche' })
  })

  it('cameraMark_ShouldShowTheGreyDot_WhenTheCameraIsCut', () => {
    // Arrange & Act
    const mark = cameraMark(makeCamera({ privacyModeActive: true }))

    // Assert
    expect(mark).toEqual({ kind: 'off', label: 'Coupée' })
  })

  it.each([
    { status: 'to_set_up', validationState: 'to_set_up' },
    { status: 'online', validationState: 'draft' },
  ])(
    'cameraMark_ShouldSayItIsToSetUpWithTheGreyDot_WhenSurveillanceHasNotTakenItIn ($validationState)',
    ({ status, validationState }) => {
      // Arrange & Act
      const mark = cameraMark(makeCamera({ status, validationState, privacyModeActive: true }))

      // Assert
      expect(mark).toEqual({ kind: 'off', label: 'À configurer' })
    },
  )

  it.each([
    { status: 'offline', connected: true, label: 'Hors ligne' },
    { status: 'online', connected: false, label: 'Hors ligne' },
    { status: 'degraded', connected: true, label: 'Dégradée' },
    { status: 'config_error', connected: true, label: 'Erreur de configuration' },
  ])(
    'cameraMark_ShouldShowTheRingAndNameTheTrouble_WhenTheCameraDoesNotWork ($status, $connected)',
    ({ status, connected, label }) => {
      // Arrange & Act
      const mark = cameraMark(makeCamera({ status, connected }))

      // Assert
      expect(mark).toEqual({ kind: 'alert', label })
    },
  )

  it('cameraMark_ShouldAskToCheckWithTheGreyDot_WhenTheStatusIsUnknown', () => {
    // Arrange & Act
    const mark = cameraMark(makeCamera({ status: 'something_new' }))

    // Assert
    expect(mark).toEqual({ kind: 'off', label: 'À vérifier' })
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
