import { describe, expect, it } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { makeCamera } from '../../testing/camera_fixture'
import { makeDetectionEvent } from '../../testing/detection_fixture'
import { failure, fakeNetwork, ok } from '../../testing/fake_network'
import { renderScreen } from '../../testing/render_screen'
import { HubView } from './hub.component'

const overview = {
  systemHealthy: true,
  recentEvents: [makeDetectionEvent()],
  profiles: [],
  notifications: { activeChannels: 0, sentCount: 0, lastSentAt: null },
  warnings: [],
}

describe('HubView', () => {
  it('onMount_ShouldSayHowManyCamerasAreWatched_WhenTheHubAndTheCamerasAnswer', async () => {
    // Arrange
    fakeNetwork({
      'GET /api/hub/overview': ok(overview),
      'GET /api/cameras': ok([makeCamera(), makeCamera({ id: 'camera-2', slug: 'garden' })]),
    })

    // Act
    renderScreen(<HubView />)

    // Assert
    expect(
      await screen.findByRole('heading', { name: '2 caméras sous surveillance' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Détection « person »')).toBeInTheDocument()
  })

  it('onMount_ShouldSayVyzioDoesNotAnswer_WhenTheOverviewFails', async () => {
    // Arrange
    fakeNetwork({
      'GET /api/hub/overview': failure(500),
      'GET /api/cameras': ok([makeCamera()]),
    })

    // Act
    renderScreen(<HubView />)

    // Assert
    expect(await screen.findByRole('heading', { name: 'Vyzio ne répond pas' })).toBeInTheDocument()
    expect(screen.getByText(/Vyzio a rencontré une erreur/)).toBeInTheDocument()
    expect(screen.getByText(/GET \/api\/hub\/overview · 500/)).toBeInTheDocument()
  })

  it('onMount_ShouldOfferToRetry_WhenTheCameraListCannotBeRead', async () => {
    // Arrange
    fakeNetwork({
      'GET /api/hub/overview': ok(overview),
      'GET /api/cameras': failure(503),
    })

    // Act
    renderScreen(<HubView />)

    // Assert
    expect(
      await screen.findByRole('heading', { name: 'Vos caméras ne s’affichent pas' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeInTheDocument()
  })

  it('onTogglePrivacy_ShouldCutEveryCameraAndSaySo_WhenTheUserConfirms', async () => {
    // Arrange
    const network = fakeNetwork({
      'GET /api/hub/overview': ok(overview),
      'GET /api/cameras': ok([makeCamera()]),
      'POST /api/cameras/privacy/batch-toggle': ok([makeCamera({ privacyModeActive: true })]),
    })
    renderScreen(<HubView />)
    await userEvent.click(await screen.findByRole('button', { name: 'Tout couper' }))
    network.answer('GET /api/cameras', ok([makeCamera({ privacyModeActive: true })]))

    // Act
    await userEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Tout couper' }),
    )

    // Assert
    expect(await screen.findByText('Caméras coupées.')).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Surveillance coupée' })).toBeInTheDocument()
    expect(network.sent).toContainEqual({
      route: 'POST /api/cameras/privacy/batch-toggle',
      query: '',
      body: { cameraIds: ['camera-1'], active: true },
    })
  })

  it('onTogglePrivacy_ShouldKeepTheRequestOpenAndSayWhy_WhenTheCameraDoesNotAnswer', async () => {
    // Arrange
    fakeNetwork({
      'GET /api/hub/overview': ok(overview),
      'GET /api/cameras': ok([makeCamera()]),
      'POST /api/cameras/privacy/batch-toggle': failure(
        502,
        'camera_unreachable',
        'DVRIP: no answer',
      ),
    })
    renderScreen(<HubView />)
    await userEvent.click(await screen.findByRole('button', { name: 'Tout couper' }))

    // Act
    await userEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Tout couper' }),
    )

    // Assert
    expect(await screen.findByText(/La caméra ne répond pas/)).toBeInTheDocument()
    expect(screen.getByText(/camera_unreachable/)).toBeInTheDocument()
    expect(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Tout couper' }),
    ).toBeEnabled()
  })
})
