import { describe, expect, it } from 'vitest'
import { CameraState, PrivacyMiss, PrivacyStrategy } from '../../domain/entities/camera.entity'
import { privacyBadge, privacyMissNotice } from './privacy_status'

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

  it.each([PrivacyMiss.CameraFailed, PrivacyMiss.Unconfirmed])(
    'privacyBadge_ShouldLeaveTheMissToItsOwnLine_WhenTheCameraDidNotConfirm (%s)',
    (miss) => {
      // Arrange & Act
      const badge = privacyBadge({ ...parked, privacyMiss: miss })

      // Assert
      expect(badge).toBeNull()
    },
  )

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

describe('privacyMissNotice', () => {
  const salon = {
    ...parked,
    id: 'camera-1',
    displayName: 'Salon',
    status: CameraState.Online,
    privacyMissDetail: null,
  }

  it.each([
    [
      true,
      PrivacyStrategy.PtzParking,
      PrivacyMiss.CameraFailed,
      'Salon : la caméra ne s’est pas tournée',
    ],
    [
      false,
      PrivacyStrategy.PtzParking,
      PrivacyMiss.CameraFailed,
      'Salon : la caméra n’a pas repris sa position',
    ],
    [
      true,
      PrivacyStrategy.PtzParking,
      PrivacyMiss.Unconfirmed,
      'Salon : la caméra ne s’est peut-être pas tournée',
    ],
    [
      false,
      PrivacyStrategy.PtzParking,
      PrivacyMiss.Unconfirmed,
      'Salon : la caméra n’a peut-être pas repris sa position',
    ],
    [
      true,
      PrivacyStrategy.Hardware,
      PrivacyMiss.CameraFailed,
      'Salon : l’objectif ne s’est pas coupé',
    ],
  ])(
    'privacyMissNotice_ShouldNameTheCameraAndTheConsequence_WhenItMissed (on: %s, %s, %s)',
    (privacyModeActive, privacyStrategy, privacyMiss, expected) => {
      // Act
      const notice = privacyMissNotice({
        ...salon,
        privacyModeActive,
        privacyStrategy,
        privacyMiss,
      })

      // Assert
      expect(notice?.title).toBe(expected)
    },
  )

  it.each([
    [PrivacyMiss.CameraFailed, true],
    [PrivacyMiss.Unconfirmed, true],
    [PrivacyMiss.PositionMissing, false],
    [PrivacyMiss.CapabilityUnverified, false],
  ])(
    'privacyMissNotice_ShouldOfferToAskAgainOnlyWhenThatFixesIt_WhenTheCameraMissed (%s)',
    (privacyMiss, expected) => {
      // Act
      const notice = privacyMissNotice({ ...salon, privacyMiss })

      // Assert
      expect(notice?.retry).toBe(expected)
    },
  )

  it('privacyMissNotice_ShouldSayWhichPositionIsMissing_WhenNoSurveillancePositionIsSaved', () => {
    // Act
    const notice = privacyMissNotice({
      ...salon,
      privacyModeActive: false,
      privacyMiss: PrivacyMiss.PositionMissing,
    })

    // Assert
    expect(notice?.missing).toBe('sa position Surveillance n’est pas enregistrée')
  })

  it('privacyMissNotice_ShouldNameTheLens_WhenTheHardwareCutIsNotVerified', () => {
    // Act
    const notice = privacyMissNotice({
      ...salon,
      privacyStrategy: PrivacyStrategy.Hardware,
      privacyMiss: PrivacyMiss.CapabilityUnverified,
    })

    // Assert
    expect(notice?.missing).toBe('sa coupure matérielle n’est pas vérifiée')
  })

  it('privacyMissNotice_ShouldScrubTheCredentials_WhenTheDiagnosticCarriesThem', () => {
    // Act
    const notice = privacyMissNotice({
      ...salon,
      privacyMiss: PrivacyMiss.CameraFailed,
      privacyMissDetail: 'rtsp://user:secret@10.0.0.2/stream refused',
    })

    // Assert
    expect(notice?.diagnostic).not.toContain('secret')
  })

  it('privacyMissNotice_ShouldTellNothing_WhenTheCameraIsOffline', () => {
    // Act
    const notice = privacyMissNotice({
      ...salon,
      status: CameraState.Offline,
      privacyMiss: PrivacyMiss.CameraFailed,
    })

    // Assert
    expect(notice).toBeNull()
  })

  it('privacyMissNotice_ShouldTellNothing_WhenTheCameraFollowed', () => {
    // Act
    const notice = privacyMissNotice(salon)

    // Assert
    expect(notice).toBeNull()
  })

  it('privacyMissNotice_ShouldTellNothing_WhenTheStrategyAsksNothingOfTheCamera', () => {
    // Act
    const notice = privacyMissNotice({
      ...salon,
      privacyStrategy: PrivacyStrategy.SoftwareBlur,
      privacyMiss: PrivacyMiss.CameraFailed,
    })

    // Assert
    expect(notice).toBeNull()
  })
})
