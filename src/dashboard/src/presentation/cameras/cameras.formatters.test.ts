import { describe, expect, it } from 'vitest'
import { makeCamera } from '../../testing/camera_fixture'
import {
  formatCameraStatusLabel,
  formatStatusTone,
  formatStreamStateLine,
} from './cameras.formatters'

describe('formatCameraStatusLabel', () => {
  it('formatCameraStatusLabel_ShouldWriteItInFrenchWithItsAccents_WhenTheCameraIsOnline', () => {
    // Arrange & Act
    const label = formatCameraStatusLabel('online')

    // Assert
    expect(label).toBe('Connectée')
  })

  it('formatCameraStatusLabel_ShouldAskToCheck_WhenTheStatusIsUnknown', () => {
    // Arrange & Act
    const label = formatCameraStatusLabel('something_new')

    // Assert
    expect(label).toBe('À vérifier')
  })

  it.each([
    { status: 'offline', label: 'Hors ligne' },
    { status: 'degraded', label: 'Dégradée' },
    { status: 'config_error', label: 'Erreur de configuration' },
  ])(
    'formatCameraStatusLabel_ShouldNameTheTrouble_WhenTheCameraIsNotOnline ($status)',
    ({ status, label }) => {
      // Arrange & Act
      const said = formatCameraStatusLabel(status)

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

describe('formatStreamStateLine', () => {
  it.each([
    {
      name: 'formatStreamStateLine_ShouldSayTheCameraAnswers_WhenItIsOnlineWithNoCheckDate',
      camera: makeCamera({ status: 'online', connected: true, lastSuccessfulFrameAt: null }),
      line: 'La caméra répond.',
    },
    {
      name: 'formatStreamStateLine_ShouldSendToTheAddressAndAccount_WhenTheCameraIsOffline',
      camera: makeCamera({ status: 'offline', connected: false }),
      line: 'Vyzio ne reçoit pas les images : vérifiez l’adresse et les identifiants de la caméra, dans Avancé.',
    },
    {
      name: 'formatStreamStateLine_ShouldSayTheImageDoesNotArrive_WhenTheCameraIsDegraded',
      camera: makeCamera({ status: 'degraded', connected: false }),
      line: 'La caméra répond, mais son image n’arrive pas : vérifiez les identifiants et les réglages du flux, dans Avancé.',
    },
    {
      name: 'formatStreamStateLine_ShouldSayVyzioCouldNotPrepareTheCamera_WhenItsSetUpFailed',
      camera: makeCamera({ status: 'config_error', connected: false }),
      line: 'Vyzio n’a pas pu préparer la surveillance de cette caméra.',
    },
    {
      name: 'formatStreamStateLine_ShouldAskForACheck_WhenTheConnectionChangedSinceTheLastOne',
      camera: makeCamera({ status: 'needs_attention', connected: false }),
      line: 'Pas encore vérifié : lancez « Vérifier » pour confirmer que Vyzio reçoit les images.',
    },
  ])('$name', ({ camera, line }) => {
    // Arrange & Act
    const said = formatStreamStateLine(camera)

    // Assert
    expect(said).toBe(line)
  })
})

describe('formatStreamStateLine dates', () => {
  it('formatStreamStateLine_ShouldDateTheLastConfirmedImage_WhenTheCameraIsOnlineWithAFrameDate', () => {
    // Arrange
    const camera = makeCamera({ connected: true, lastSuccessfulFrameAt: '2026-09-12T08:30:00Z' })

    // Act
    const said = formatStreamStateLine(camera)

    // Assert
    expect(said).toMatch(/^Dernière image confirmée le 12 sept\., \d{2}:30$/)
  })
})
