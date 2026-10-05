import { describe, expect, it } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { makeCamera } from '../../testing/camera_fixture'
import { makeDetectionEvent } from '../../testing/detection_fixture'
import { failure, fakeNetwork, ok } from '../../testing/fake_network'
import { renderScreen } from '../../testing/render_screen'
import { pollTheSurveillance } from '../../testing/shared_reads'
import type { SystemStats } from '../../domain/entities/system_stats.entity'
import { HubView } from './hub.component'

const overview = {
  systemHealthy: true,
  recentEvents: [makeDetectionEvent()],
  profiles: [],
  notifications: { activeChannels: 0, sentCount: 0, lastSentAt: null },
  warnings: [],
}

// An empty catalogue: a detection keeps its engine label.
const reference = { 'GET /api/detection-labels/camera': ok([]) }

const running: SystemStats = {
  status: 'active',
  storage: { totalGb: 100, usedGb: 40, freeGb: 60 },
  cameras: [{ camera: 'front_door', fps: 10 }],
  detection: { hardware: 'cpu', targetFps: 5 },
  pendingChanges: false,
}

describe('HubView', () => {
  it('onMount_ShouldSayHowManyCamerasAreWatched_WhenTheHubAndTheCamerasAnswer', async () => {
    // Arrange
    fakeNetwork({
      ...reference,
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

  it('onMount_ShouldWarnAndKeepTheEngineLabel_WhenTheLabelCatalogueFails', async () => {
    // Arrange
    fakeNetwork({
      ...reference,
      'GET /api/hub/overview': ok(overview),
      'GET /api/cameras': ok([makeCamera()]),
      'GET /api/detection-labels/camera': failure(500),
    })

    // Act
    renderScreen(<HubView />)

    // Assert
    expect(await screen.findByText(/Vyzio a rencontré une erreur/)).toBeInTheDocument()
    expect(screen.getByText('Détection « person »')).toBeInTheDocument()
  })

  it('onMount_ShouldNameADetectionInFrench_WhenTheLabelCatalogueAnswers', async () => {
    // Arrange
    fakeNetwork({
      ...reference,
      'GET /api/hub/overview': ok(overview),
      'GET /api/cameras': ok([makeCamera()]),
      'GET /api/detection-labels/camera': ok([
        { value: 'person', displayName: 'Personne', emoji: '🚶' },
      ]),
    })

    // Act
    renderScreen(<HubView />)

    // Assert
    expect(await screen.findByText('Détection « Personne »')).toBeInTheDocument()
  })

  it('onOpenLive_ShouldPointAtConnexionInsteadOfTheJoystick_WhenTheOrientationIsToConfirm', async () => {
    // Arrange
    fakeNetwork({
      ...reference,
      'GET /api/hub/overview': ok(overview),
      'GET /api/cameras': ok([makeCamera({ ptzSupported: true, verifiedCapabilities: [] })]),
    })
    renderScreen(<HubView />)

    // Act
    await userEvent.click(await screen.findByRole('button', { name: 'Front Door' }))

    // Assert
    expect(await screen.findByRole('link', { name: 'Connexion' })).toHaveAttribute(
      'href',
      '/settings/cameras/camera-1/connexion',
    )
    expect(screen.queryByTitle('Haut')).not.toBeInTheDocument()
  })

  it('onMount_ShouldSayVyzioDoesNotAnswer_WhenTheOverviewFails', async () => {
    // Arrange
    fakeNetwork({
      ...reference,
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
      ...reference,
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

  it('onReloadCameras_ShouldShowTheCameras_WhenTheRetryReadsTheList', async () => {
    // Arrange
    const network = fakeNetwork({
      ...reference,
      'GET /api/hub/overview': ok(overview),
      'GET /api/cameras': failure(503),
    })
    renderScreen(<HubView />)
    await screen.findByRole('heading', { name: 'Vos caméras ne s’affichent pas' })
    network.answer('GET /api/cameras', ok([makeCamera()]))

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Réessayer' }))

    // Assert
    expect(
      await screen.findByRole('heading', { name: '1 caméra sous surveillance' }),
    ).toBeInTheDocument()
  })

  it('render_ShouldLeaveOutOfTheCountAndLeadToItsPage_WhenACameraIsToSetUp', async () => {
    // Arrange
    fakeNetwork({
      ...reference,
      'GET /api/hub/overview': ok(overview),
      'GET /api/cameras': ok([
        makeCamera(),
        makeCamera({
          id: 'camera-2',
          displayName: 'Garage',
          status: 'to_set_up',
          validationState: 'to_set_up',
          connected: false,
        }),
      ]),
    })

    // Act
    renderScreen(<HubView />)

    // Assert
    expect(
      await screen.findByRole('heading', { name: '1 caméra sous surveillance' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'À configurer : Garage' })).toHaveAttribute(
      'href',
      '/settings/cameras/camera-2',
    )
  })

  it('onTogglePrivacy_ShouldCutEveryCameraAndSaySo_WhenTheUserConfirms', async () => {
    // Arrange
    const network = fakeNetwork({
      ...reference,
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
      ...reference,
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

  it('SurveillanceCard_ShouldShowOnlyTheStateAndTheDisk_WhenSurveillanceRuns', async () => {
    // Arrange
    fakeNetwork({
      ...reference,
      'GET /api/hub/overview': ok(overview),
      'GET /api/cameras': ok([makeCamera()]),
      'GET /api/system/stats': ok(running),
    })
    renderScreen(<HubView />)
    await screen.findByRole('heading', { name: '1 caméra sous surveillance' })

    // Act
    await pollTheSurveillance()

    // Assert
    const card = within(screen.getByRole('region', { name: 'Surveillance' }))
    expect(card.getByText('En marche')).toBeVisible()
    expect(card.getByText('60 Go libres sur 100 Go')).toBeVisible()
    expect(card.getByText('Processeur · 5 images par seconde')).not.toBeVisible()
    expect(card.getByText('Front Door')).not.toBeVisible()
  })

  it('SurveillanceCard_ShouldShowTheFiguresUnderTheCameraNames_WhenTheUserOpensTheDetails', async () => {
    // Arrange
    fakeNetwork({
      ...reference,
      'GET /api/hub/overview': ok(overview),
      'GET /api/cameras': ok([makeCamera()]),
      'GET /api/system/stats': ok(running),
    })
    renderScreen(<HubView />)
    await screen.findByRole('heading', { name: '1 caméra sous surveillance' })
    await pollTheSurveillance()
    const card = within(screen.getByRole('region', { name: 'Surveillance' }))

    // Act
    await userEvent.click(card.getByText('Détails techniques'))

    // Assert
    expect(card.getByText('Processeur · 5 images par seconde')).toBeVisible()
    expect(card.getByText('Front Door')).toBeVisible()
    expect(card.getByText('10,0')).toBeVisible()
  })

  it('SurveillanceCard_ShouldKeepTheDetailsClosed_WhenACameraIsOfflineAndAnotherSendsFewImages', async () => {
    // Arrange
    fakeNetwork({
      ...reference,
      'GET /api/hub/overview': ok(overview),
      'GET /api/cameras': ok([
        makeCamera(),
        makeCamera({ id: 'camera-2', frigateCameraName: 'garden', status: 'offline' }),
      ]),
      'GET /api/system/stats': ok({
        ...running,
        cameras: [
          { camera: 'front_door', fps: 0.4 },
          { camera: 'garden', fps: 0 },
        ],
      }),
    })
    renderScreen(<HubView />)
    await screen.findByRole('heading', { name: '2 caméras sous surveillance' })

    // Act
    await pollTheSurveillance()

    // Assert
    const card = within(screen.getByRole('region', { name: 'Surveillance' }))
    expect(card.getByText('0,4')).not.toBeVisible()
    expect(card.getByText('0,0')).not.toBeVisible()
  })
})
