import { describe, expect, it } from 'vitest'
import { makeCamera } from '../../testing/camera_fixture'
import { formatStreamFailureLine, formatStreamWorkingLine } from './cameras.formatters'

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
