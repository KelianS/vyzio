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

    expect(badge?.text).toBe('La caméra n’a pas suivi, enregistrement désactivé')
    expect(badge?.tone).toBe('warn')
  })

  it('privacyBadge_ShouldClaimNoMove_WhenTheCameraAnswerDidNotArrive', () => {
    expect(privacyBadge({ ...parked, privacyMiss: PrivacyMiss.Unconfirmed })?.text).toBe(
      'Enregistrement désactivé',
    )
  })

  it('privacyBadge_ShouldShowNothing_WhenPrivacyIsOff', () => {
    expect(
      privacyBadge({ ...parked, privacyModeActive: false, privacyMiss: PrivacyMiss.CameraFailed }),
    ).toBeNull()
  })
})

describe('privacyMissSentence', () => {
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
  it('privacyMissLabel_ShouldNotBlameTheCamera_WhenItsAnswerDidNotArrive', () => {
    expect(privacyMissLabel(PrivacyMiss.Unconfirmed)).toBe('Réponse de la caméra non reçue')
    expect(privacyMissLabel(PrivacyMiss.CameraFailed)).toBe('La caméra n’a pas suivi')
  })
})
