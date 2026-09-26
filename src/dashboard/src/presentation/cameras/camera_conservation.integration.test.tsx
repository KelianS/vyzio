import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { makeDetectionConfig } from '../../testing/detection_config_fixture'
import { failure, fakeNetwork, ok } from '../../testing/fake_network'
import { renderScreen } from '../../testing/render_screen'
import { CameraConservationView } from './camera_conservation.component'

const CONSERVATION_TAB = {
  path: '/settings/cameras/:cameraId/conservation',
  url: '/settings/cameras/camera-1/conservation',
}

async function setMotionToTenDays() {
  const motion = await screen.findByLabelText('Séquences de mouvement')
  await userEvent.clear(motion)
  await userEvent.type(motion, '10')
  await userEvent.tab()
}

describe('CameraConservationView', () => {
  it('onSave_ShouldSaveTheOverrideAndKeepTheDetection_WhenTheUserSetsADuration', async () => {
    // Arrange
    const network = fakeNetwork({
      'GET /api/cameras/camera-1/detection-config': ok(makeDetectionConfig()),
      'PUT /api/cameras/camera-1/detection-config': ok(makeDetectionConfig()),
      'GET /api/system/stats': ok(null),
    })
    renderScreen(<CameraConservationView />, CONSERVATION_TAB)
    await setMotionToTenDays()

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    // Assert
    expect(await screen.findByText('Durées de conservation enregistrées.')).toBeInTheDocument()
    expect(network.sent).toContainEqual(
      expect.objectContaining({
        route: 'PUT /api/cameras/camera-1/detection-config',
        body: expect.objectContaining({
          motionDaysOverride: 10,
          continuousDaysOverride: null,
          labels: ['person'],
        }),
      }),
    )
  })

  it('onSave_ShouldKeepTheDraftAndSayWhy_WhenTheSaveFails', async () => {
    // Arrange
    fakeNetwork({
      'GET /api/cameras/camera-1/detection-config': ok(makeDetectionConfig()),
      'PUT /api/cameras/camera-1/detection-config': failure(500),
    })
    renderScreen(<CameraConservationView />, CONSERVATION_TAB)
    await setMotionToTenDays()

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    // Assert
    expect(
      await screen.findByText(/PUT \/api\/cameras\/camera-1\/detection-config · 500/),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Séquences de mouvement')).toHaveValue(10)
  })

  it('onLoad_ShouldSayWhyAndForSupport_WhenTheSettingsCannotBeRead', async () => {
    // Arrange
    fakeNetwork({ 'GET /api/cameras/camera-1/detection-config': failure(500) })

    // Act
    renderScreen(<CameraConservationView />, CONSERVATION_TAB)

    // Assert
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Vyzio a rencontré une erreur')
    expect(alert).toHaveTextContent('GET /api/cameras/camera-1/detection-config · 500')
  })

  it('onRetry_ShouldShowTheDurations_WhenTheSecondReadSucceeds', async () => {
    // Arrange
    const network = fakeNetwork({ 'GET /api/cameras/camera-1/detection-config': failure(500) })
    renderScreen(<CameraConservationView />, CONSERVATION_TAB)
    await screen.findByRole('alert')
    network.answer('GET /api/cameras/camera-1/detection-config', ok(makeDetectionConfig()))

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Réessayer' }))

    // Assert
    expect(await screen.findByLabelText('Séquences de mouvement')).toHaveValue(7)
  })
})
