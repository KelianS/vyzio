import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { makeDetectionConfig } from '../../testing/detection_config_fixture'
import { failure, fakeNetwork, ok } from '../../testing/fake_network'
import { renderScreen } from '../../testing/render_screen'
import { CameraDetectionView } from './camera_detection.component'

const DETECTION_TAB = {
  path: '/settings/cameras/:cameraId/detection',
  url: '/settings/cameras/camera-1/detection',
}

const labels = [
  { value: 'person', displayName: 'Personne', emoji: '🧍' },
  { value: 'car', displayName: 'Voiture', emoji: '🚗' },
]

async function addCarsToWhatIsDetected() {
  await userEvent.click(await screen.findByRole('combobox', { name: 'Ce qui est détecté' }))
  await userEvent.click(screen.getByRole('checkbox', { name: '🚗 Voiture' }))
}

describe('CameraDetectionView', () => {
  it('onSave_ShouldSaveTheChangeAndKeepTheRetention_WhenTheUserSaves', async () => {
    // Arrange
    const network = fakeNetwork({
      'GET /api/cameras/camera-1/detection-config': ok(makeDetectionConfig()),
      'GET /api/detection-labels/camera': ok(labels),
      'PUT /api/cameras/camera-1/detection-config': ok(makeDetectionConfig()),
      'GET /api/system/stats': ok(null),
    })
    renderScreen(<CameraDetectionView />, DETECTION_TAB)
    await addCarsToWhatIsDetected()

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    // Assert
    expect(await screen.findByText('Réglages de détection enregistrés.')).toBeInTheDocument()
    expect(network.sent).toContainEqual(
      expect.objectContaining({
        route: 'PUT /api/cameras/camera-1/detection-config',
        body: expect.objectContaining({
          labels: ['person', 'car'],
          eventClipDaysOverride: 30,
        }),
      }),
    )
    expect(network.sent).toContainEqual(expect.objectContaining({ route: 'GET /api/system/stats' }))
  })

  it('onLoad_ShouldSayWhyAndForSupport_WhenTheSettingsCannotBeRead', async () => {
    // Arrange
    fakeNetwork({
      'GET /api/cameras/camera-1/detection-config': failure(500),
      'GET /api/detection-labels/camera': ok(labels),
    })

    // Act
    renderScreen(<CameraDetectionView />, DETECTION_TAB)

    // Assert
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Vyzio a rencontré une erreur')
    expect(alert).toHaveTextContent('GET /api/cameras/camera-1/detection-config · 500')
  })

  it('onLoad_ShouldShowTheSettings_WhenRetriedOnceTheServerAnswers', async () => {
    // Arrange
    const network = fakeNetwork({
      'GET /api/cameras/camera-1/detection-config': failure(500),
      'GET /api/detection-labels/camera': ok(labels),
    })
    renderScreen(<CameraDetectionView />, DETECTION_TAB)
    await screen.findByRole('alert')
    network.answer('GET /api/cameras/camera-1/detection-config', ok(makeDetectionConfig()))

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Réessayer' }))

    // Assert
    expect(await screen.findByRole('combobox', { name: 'Ce qui est détecté' })).toHaveTextContent(
      '🧍 Personne',
    )
  })

  it('onLoad_ShouldReadTheCatalogueAgain_WhenItsFirstReadFailed', async () => {
    // Arrange
    const network = fakeNetwork({
      'GET /api/cameras/camera-1/detection-config': ok(makeDetectionConfig()),
      'GET /api/detection-labels/camera': failure(500),
    })
    renderScreen(<CameraDetectionView />, DETECTION_TAB)
    await screen.findByRole('alert')
    network.answer('GET /api/detection-labels/camera', ok(labels))

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Réessayer' }))

    // Assert
    expect(await screen.findByRole('combobox', { name: 'Ce qui est détecté' })).toHaveTextContent(
      '🧍 Personne',
    )
  })

  it('onSave_ShouldKeepTheDraftAndSayWhy_WhenTheSaveFails', async () => {
    // Arrange
    fakeNetwork({
      'GET /api/cameras/camera-1/detection-config': ok(makeDetectionConfig()),
      'GET /api/detection-labels/camera': ok(labels),
      'PUT /api/cameras/camera-1/detection-config': failure(500),
    })
    renderScreen(<CameraDetectionView />, DETECTION_TAB)
    await addCarsToWhatIsDetected()

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    // Assert
    expect(
      await screen.findByText(/PUT \/api\/cameras\/camera-1\/detection-config · 500/),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Enregistrer' })).toBeEnabled()
  })
})
