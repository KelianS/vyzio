import { describe, expect, it } from 'vitest'
import { PrivacyMiss, PrivacyStrategy } from '../../domain/entities/camera.entity'
import { privacyBadge, privacyMissLabel, privacyMissSentence } from './privacy_status'

const parked = {
  privacyModeActive: true,
  privacyStrategy: PrivacyStrategy.PtzParking,
  privacyVendorCut: false,
  privacyMiss: null,
}

describe('privacyBadge', () => {
  it('privacyBadge_ShouldSayTheCameraTurned_WhenItAcceptedTheParkingMove', () => {
    // Arrange & Act
    const badge = privacyBadge(parked)

    // Assert
    expect(badge?.text).toBe('Caméra orientée, enregistrement désactivé')
  })

  it('privacyBadge_ShouldSayTheCameraDidNotFollow_WhenItRefusedTheMove', () => {
    // Arrange & Act
    const badge = privacyBadge({ ...parked, privacyMiss: PrivacyMiss.CameraFailed })

    // Assert
    expect(badge?.text).toBe('Caméra non tournée, enregistrement désactivé')
    expect(badge?.tone).toBe('warn')
  })

  it('privacyBadge_ShouldClaimNoMove_WhenTheCameraAnswerDidNotArrive', () => {
    // Arrange & Act
    const badge = privacyBadge({ ...parked, privacyMiss: PrivacyMiss.Unconfirmed })

    // Assert
    expect(badge?.text).toBe('Enregistrement désactivé')
  })

  it('privacyBadge_ShouldClaimNoMiss_WhenTheMissBelongsToAStrategyThatAsksNothingOfTheCamera', () => {
    // Arrange & Act
    const badge = privacyBadge({
      ...parked,
      privacyStrategy: PrivacyStrategy.SoftwareBlur,
      privacyMiss: PrivacyMiss.CameraFailed,
    })

    // Assert
    expect(badge?.text).toBe('Enregistrement désactivé')
  })

  it('privacyBadge_ShouldShowNothing_WhenPrivacyIsOff', () => {
    // Arrange & Act
    const badge = privacyBadge({
      ...parked,
      privacyModeActive: false,
      privacyMiss: PrivacyMiss.CameraFailed,
    })

    // Assert
    expect(badge).toBeNull()
  })
})

describe('privacyMissSentence', () => {
  it('privacyMissSentence_ShouldSayNothing_WhenTheMissBelongsToAStrategyThatAsksNothingOfTheCamera', () => {
    // Arrange & Act
    const sentence = privacyMissSentence({
      ...parked,
      privacyStrategy: PrivacyStrategy.SoftwareBlur,
      privacyMiss: PrivacyMiss.CameraFailed,
    })

    // Assert
    expect(sentence).toBeNull()
  })

  it('privacyMissSentence_ShouldSayNothing_WhenTheCameraFollowed', () => {
    // Arrange & Act
    const sentence = privacyMissSentence(parked)

    // Assert
    expect(sentence).toBeNull()
  })

  it('privacyMissSentence_ShouldPointAtWhereToSaveIt_WhenNoParkingPositionIsSaved', () => {
    // Arrange & Act
    const sentence = privacyMissSentence({ ...parked, privacyMiss: PrivacyMiss.PositionMissing })

    // Assert
    expect(sentence).toBe(
      'Aucune position Parking n’est enregistrée : la caméra est restée où elle était. Enregistrez-la dans « Image et pilotage ».',
    )
  })

  it('privacyMissSentence_ShouldSayTheCameraDidNotComeBack_WhenPrivacyEndedOnAFailedMove', () => {
    // Arrange & Act
    const sentence = privacyMissSentence({
      ...parked,
      privacyModeActive: false,
      privacyMiss: PrivacyMiss.CameraFailed,
    })

    // Assert
    expect(sentence).toMatch(/^La caméra n’est pas revenue sur sa position Surveillance/)
  })

  it('privacyMissSentence_ShouldSayTheCameraDidNotComeBack_WhenNoSurveillancePositionIsSaved', () => {
    // Arrange & Act
    const sentence = privacyMissSentence({
      ...parked,
      privacyModeActive: false,
      privacyMiss: PrivacyMiss.PositionMissing,
    })

    // Assert
    expect(sentence).toBe(
      'Aucune position Surveillance n’est enregistrée : la caméra n’est pas revenue. Enregistrez-la dans « Image et pilotage ».',
    )
  })

  it('privacyMissSentence_ShouldSayTheCameraMayStillFilm_WhenItRefusedTheParkingMove', () => {
    // Arrange & Act
    const sentence = privacyMissSentence({ ...parked, privacyMiss: PrivacyMiss.CameraFailed })

    // Assert
    expect(sentence).toBe(
      'La caméra ne s’est pas tournée vers sa position Parking : elle filme peut-être encore, mais Vyzio n’enregistre plus rien. Vérifiez qu’elle est allumée et connectée.',
    )
  })

  it('privacyMissSentence_ShouldSayRecordingIsCutButTheMoveIsUnknown_WhenTheCutWasInterrupted', () => {
    // Arrange & Act
    const sentence = privacyMissSentence({ ...parked, privacyMiss: PrivacyMiss.Unconfirmed })

    // Assert
    expect(sentence).toBe(
      'La demande a été interrompue avant la réponse de la caméra : Vyzio ne sait pas si elle a suivi. L’enregistrement est bien coupé.',
    )
  })

  it('privacyMissSentence_ShouldSayRecordingResumedButTheReturnIsUnknown_WhenTheResumeWasInterrupted', () => {
    // Arrange & Act
    const sentence = privacyMissSentence({
      ...parked,
      privacyModeActive: false,
      privacyMiss: PrivacyMiss.Unconfirmed,
    })

    // Assert
    expect(sentence).toBe(
      'La demande a été interrompue avant la réponse de la caméra : Vyzio ne sait pas si elle est revenue sur sa position Surveillance. L’enregistrement a repris.',
    )
  })

  it('privacyMissSentence_ShouldNameTheLens_WhenTheHardwareCutIsNotVerified', () => {
    // Arrange & Act
    const sentence = privacyMissSentence({
      ...parked,
      privacyStrategy: PrivacyStrategy.Hardware,
      privacyMiss: PrivacyMiss.CapabilityUnverified,
    })

    // Assert
    expect(sentence).toBe(
      'La coupure matérielle de cette caméra n’est pas vérifiée : seul l’enregistrement est coupé.',
    )
  })
})

describe('privacyMissLabel', () => {
  it('privacyMissLabel_ShouldNotBlameTheCamera_WhenTheRequestWasInterrupted', () => {
    // Arrange & Act
    const label = privacyMissLabel({ ...parked, privacyMiss: PrivacyMiss.Unconfirmed })

    // Assert
    expect(label).toBe('Demande interrompue')
  })

  it('privacyMissLabel_ShouldSayTheCameraDidNotTurn_WhenTheParkingMoveFailed', () => {
    // Arrange & Act
    const label = privacyMissLabel({ ...parked, privacyMiss: PrivacyMiss.CameraFailed })

    // Assert
    expect(label).toBe('La caméra ne s’est pas tournée')
  })

  it('privacyMissLabel_ShouldSayTheCameraDidNotComeBack_WhenTheReturnFailed', () => {
    // Arrange & Act
    const label = privacyMissLabel({
      ...parked,
      privacyModeActive: false,
      privacyMiss: PrivacyMiss.CameraFailed,
    })

    // Assert
    expect(label).toBe('La caméra n’est pas revenue')
  })

  it('privacyMissLabel_ShouldNameTheLens_WhenTheHardwareCutFailed', () => {
    // Arrange & Act
    const label = privacyMissLabel({
      ...parked,
      privacyStrategy: PrivacyStrategy.Hardware,
      privacyMiss: PrivacyMiss.CameraFailed,
    })

    // Assert
    expect(label).toBe('L’objectif ne s’est pas coupé')
  })
})
