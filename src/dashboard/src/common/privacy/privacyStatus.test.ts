import { describe, expect, it } from 'vitest'
import { PrivacyMiss, PrivacyStrategy } from '../../domain/entities/Camera'
import { privacyBadge, privacyMissLabel, privacyMissSentence } from './privacyStatus'

const parked = {
  privacyModeActive: true,
  privacyStrategy: PrivacyStrategy.PtzParking,
  privacyVendorCut: false,
  privacyMiss: null,
}

describe('privacyBadge', () => {
  it('privacyBadge_ShouldSayTheCameraTurned_WhenItAcceptedTheParkingMove', () => {
    expect(privacyBadge(parked)?.text).toBe('Caméra orientée, enregistrement désactivé')
  })

  it('privacyBadge_ShouldSayTheCameraDidNotFollow_WhenItRefusedTheMove', () => {
    const badge = privacyBadge({ ...parked, privacyMiss: PrivacyMiss.CameraFailed })

    expect(badge?.text).toBe('Caméra non tournée, enregistrement désactivé')
    expect(badge?.tone).toBe('warn')
  })

  it('privacyBadge_ShouldClaimNoMove_WhenTheCameraAnswerDidNotArrive', () => {
    expect(privacyBadge({ ...parked, privacyMiss: PrivacyMiss.Unconfirmed })?.text).toBe(
      'Enregistrement désactivé',
    )
  })

  it('privacyBadge_ShouldClaimNoMiss_WhenTheMissBelongsToAStrategyThatAsksNothingOfTheCamera', () => {
    expect(
      privacyBadge({
        ...parked,
        privacyStrategy: PrivacyStrategy.SoftwareBlur,
        privacyMiss: PrivacyMiss.CameraFailed,
      })?.text,
    ).toBe('Enregistrement désactivé')
  })

  it('privacyBadge_ShouldShowNothing_WhenPrivacyIsOff', () => {
    expect(
      privacyBadge({ ...parked, privacyModeActive: false, privacyMiss: PrivacyMiss.CameraFailed }),
    ).toBeNull()
  })
})

describe('privacyMissSentence', () => {
  it('privacyMissSentence_ShouldSayNothing_WhenTheMissBelongsToAStrategyThatAsksNothingOfTheCamera', () => {
    expect(
      privacyMissSentence({
        ...parked,
        privacyStrategy: PrivacyStrategy.SoftwareBlur,
        privacyMiss: PrivacyMiss.CameraFailed,
      }),
    ).toBeNull()
  })

  it('privacyMissSentence_ShouldSayNothing_WhenTheCameraFollowed', () => {
    expect(privacyMissSentence(parked)).toBeNull()
  })

  it('privacyMissSentence_ShouldPointAtWhereToSaveIt_WhenNoParkingPositionIsSaved', () => {
    expect(privacyMissSentence({ ...parked, privacyMiss: PrivacyMiss.PositionMissing })).toBe(
      'Aucune position Parking n’est enregistrée : la caméra est restée où elle était. Enregistrez-la dans « Image et pilotage ».',
    )
  })

  it('privacyMissSentence_ShouldSayTheCameraDidNotComeBack_WhenPrivacyEndedOnAFailedMove', () => {
    expect(
      privacyMissSentence({
        ...parked,
        privacyModeActive: false,
        privacyMiss: PrivacyMiss.CameraFailed,
      }),
    ).toMatch(/^La caméra n’est pas revenue sur sa position Surveillance/)
  })

  it('privacyMissSentence_ShouldNameTheLens_WhenTheHardwareCutIsNotVerified', () => {
    expect(
      privacyMissSentence({
        ...parked,
        privacyStrategy: PrivacyStrategy.Hardware,
        privacyMiss: PrivacyMiss.CapabilityUnverified,
      }),
    ).toBe(
      'La coupure matérielle de cette caméra n’est pas vérifiée : seul l’enregistrement est coupé.',
    )
  })
})

describe('privacyMissLabel', () => {
  it('privacyMissLabel_ShouldNotBlameTheCamera_WhenTheRequestWasInterrupted', () => {
    expect(privacyMissLabel({ ...parked, privacyMiss: PrivacyMiss.Unconfirmed })).toBe(
      'Demande interrompue',
    )
  })

  it('privacyMissLabel_ShouldSayTheCameraDidNotTurn_WhenTheParkingMoveFailed', () => {
    expect(privacyMissLabel({ ...parked, privacyMiss: PrivacyMiss.CameraFailed })).toBe(
      'La caméra ne s’est pas tournée',
    )
  })

  it('privacyMissLabel_ShouldSayTheCameraDidNotComeBack_WhenTheReturnFailed', () => {
    expect(
      privacyMissLabel({
        ...parked,
        privacyModeActive: false,
        privacyMiss: PrivacyMiss.CameraFailed,
      }),
    ).toBe('La caméra n’est pas revenue')
  })

  it('privacyMissLabel_ShouldNameTheLens_WhenTheHardwareCutFailed', () => {
    expect(
      privacyMissLabel({
        ...parked,
        privacyStrategy: PrivacyStrategy.Hardware,
        privacyMiss: PrivacyMiss.CameraFailed,
      }),
    ).toBe('L’objectif ne s’est pas coupé')
  })
})
