import { describe, expect, it } from 'vitest'
import { makeCamera } from '../../testing/camera_fixture'
import {
  formatCameraStatusLabel,
  formatStatusTone,
  formatStreamFailureLine,
  formatStreamWorkingLine,
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

describe('formatStreamFailureLine', () => {
  it.each([
    {
      name: 'formatStreamFailureLine_ShouldSendToTheAddressAndAccount_WhenTheCameraIsOffline',
      camera: makeCamera({ status: 'offline', connected: false }),
      line: 'Vyzio ne reçoit pas les images : vérifiez l’adresse et le compte de la caméra dans Avancé, puis les options du flux vidéo.',
    },
    {
      name: 'formatStreamFailureLine_ShouldSayTheImageDoesNotArrive_WhenTheCameraIsDegraded',
      camera: makeCamera({ status: 'degraded', connected: false }),
      line: 'La caméra répond, mais son image n’arrive pas : vérifiez le compte de la caméra dans Avancé, puis les options du flux vidéo.',
    },
    {
      name: 'formatStreamFailureLine_ShouldSayTheImageDoesNotArrive_WhenOnlyThePortAnswers',
      camera: makeCamera({ status: 'online', connected: true }),
      line: 'La caméra répond, mais son image n’arrive pas : vérifiez le compte de la caméra dans Avancé, puis les options du flux vidéo.',
    },
    {
      name: 'formatStreamFailureLine_ShouldSayTheCheckFailed_WhenTheStatusSaysNothingMore',
      camera: makeCamera({ status: 'needs_attention', connected: false }),
      line: 'La dernière vérification a échoué : vérifiez l’adresse et le compte de la caméra dans Avancé, puis les options du flux vidéo.',
    },
  ])('$name', ({ camera, line }) => {
    // Arrange & Act
    const said = formatStreamFailureLine(camera)

    // Assert
    expect(said).toBe(line)
  })
})

describe('formatStreamWorkingLine', () => {
  it('formatStreamWorkingLine_ShouldDateTheLastConfirmedImage_WhenTheCameraHasAFrameDate', () => {
    // Arrange
    const camera = makeCamera({ lastSuccessfulFrameAt: '2026-09-12T08:30:00Z' })

    // Act
    const said = formatStreamWorkingLine(camera, null)

    // Assert
    expect(said).toMatch(/^Dernière image confirmée le 12 sept\., \d{2}:30$/)
  })

  it('formatStreamWorkingLine_ShouldDateTheLastCheck_WhenNoImageWasConfirmed', () => {
    // Arrange
    const camera = makeCamera({ lastSuccessfulFrameAt: null })

    // Act
    const said = formatStreamWorkingLine(camera, '2026-09-12T08:30:00Z')

    // Assert
    expect(said).toMatch(/^Vérifié le 12 sept\., \d{2}:30$/)
  })

  it('formatStreamWorkingLine_ShouldSayNothing_WhenNeitherIsKnown', () => {
    // Arrange
    const camera = makeCamera({ lastSuccessfulFrameAt: null })

    // Act
    const said = formatStreamWorkingLine(camera, null)

    // Assert
    expect(said).toBeNull()
  })
})
