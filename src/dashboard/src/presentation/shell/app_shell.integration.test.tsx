import { describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { PrivacyMiss, PrivacyStrategy } from '../../domain/entities/camera.entity'
import { makeCamera } from '../../testing/camera_fixture'
import { failure, fakeNetwork, ok } from '../../testing/fake_network'
import { renderScreen } from '../../testing/render_screen'
import { appContainer } from '../../infrastructure/providers/app.container'
import { useRootStore } from '../../infrastructure/store/root.store'
import { AppContainerProvider } from '../../infrastructure/providers/app_container.context'
import { ToastProvider } from '../../common/components/toast'
import { PageHeader } from '../../common/components/page_header'
import type { SystemStats } from '../../domain/entities/system_stats.entity'
import { AddCameraView } from '../cameras/add_camera.component'
import { AppShell } from './app_shell.component'

function stats(overrides: Partial<SystemStats> = {}): SystemStats {
  return {
    status: 'active',
    storage: { totalGb: 100, usedGb: 40, freeGb: 60 },
    cameras: [],
    detection: { hardware: 'cpu', targetFps: 5 },
    pendingChanges: false,
    ...overrides,
  }
}

/** The shell around a few pages, as the app routes them. */
function openShellAt(...entries: string[]) {
  useRootStore.setState(useRootStore.getInitialState(), true)
  const router = createMemoryRouter(
    [
      {
        element: (
          <AppContainerProvider>
            <ToastProvider>
              <AppShell />
            </ToastProvider>
          </AppContainerProvider>
        ),
        children: [
          { path: '/', element: <p>Accueil</p> },
          { path: '/detections', element: <PageHeader title="Détections" /> },
          { path: '/settings', element: <PageHeader title="Réglages" /> },
          { path: '/settings/cameras/add', element: <AddCameraView /> },
        ],
      },
    ],
    { initialEntries: entries, initialIndex: entries.length - 1 },
  )
  render(<RouterProvider router={router} />)
  return router
}

describe('AppShell', () => {
  it('onMount_ShouldReadTheCamerasAndTheSystemForEveryScreen_WhenTheShellOpens', async () => {
    // Arrange
    const network = fakeNetwork({
      'GET /api/cameras': ok([makeCamera()]),
      'GET /api/system/stats': ok(null),
    })

    // Act
    renderScreen(<AppShell />)

    // Assert
    await waitFor(() => expect(useRootStore.getState().cameras).toHaveLength(1))
    expect(network.sent).toContainEqual(expect.objectContaining({ route: 'GET /api/system/stats' }))
  })

  it('useCameraListFailureToast_ShouldSayWhy_WhenAReloadFailsUnderAShownList', async () => {
    // Arrange
    const network = fakeNetwork({
      'GET /api/cameras': ok([makeCamera()]),
      'GET /api/system/stats': ok(null),
    })
    renderScreen(<AppShell />)
    await waitFor(() => expect(useRootStore.getState().cameras).toHaveLength(1))
    network.answer('GET /api/cameras', failure(500))

    // Act
    await act(() => useRootStore.getState().loadCameras(appContainer.cameras.getCameras))

    // Assert
    expect(await screen.findByText(/Vyzio a rencontré une erreur/)).toBeInTheDocument()
    expect(screen.getByText(/GET \/api\/cameras · 500/)).toBeVisible()
  })

  it('TopBar_ShouldCarryTheNameAndTheWayToTheSettings_WhenTheHomeIsOpen', async () => {
    // Arrange
    fakeNetwork({ 'GET /api/cameras': ok([]), 'GET /api/system/stats': ok(stats()) })

    // Act
    openShellAt('/')

    // Assert
    const bar = await screen.findByRole('banner')
    expect(within(bar).getByText('Vyzio')).toBeVisible()
    expect(within(bar).getByRole('link', { name: 'Réglages' })).toHaveAttribute('href', '/settings')
    expect(within(bar).queryByRole('button', { name: 'Retour' })).not.toBeInTheDocument()
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })

  it('TopBar_ShouldShowThePageTitleBesideTheWayBack_WhenAnInnerPageIsOpen', async () => {
    // Arrange
    fakeNetwork({ 'GET /api/cameras': ok([]), 'GET /api/system/stats': ok(stats()) })

    // Act
    openShellAt('/detections')

    // Assert
    const bar = await screen.findByRole('banner')
    expect(await within(bar).findByRole('heading', { level: 1, name: 'Détections' })).toBeVisible()
    expect(within(bar).getByRole('button', { name: 'Retour' })).toBeVisible()
  })

  it('TopBar_ShouldOfferTheWayBack_WhenACameraIsAddedBesideOthers', async () => {
    // Arrange
    fakeNetwork({ 'GET /api/cameras': ok([makeCamera()]), 'GET /api/system/stats': ok(stats()) })

    // Act
    openShellAt('/settings/cameras/add')

    // Assert
    const bar = await screen.findByRole('banner')
    await waitFor(() => expect(useRootStore.getState().cameras).toHaveLength(1))
    expect(within(bar).getByRole('button', { name: 'Retour' })).toBeVisible()
  })

  it('BackButton_ShouldReturnToThePreviousPage_WhenThereIsOne', async () => {
    // Arrange
    fakeNetwork({ 'GET /api/cameras': ok([]), 'GET /api/system/stats': ok(stats()) })
    const router = openShellAt('/settings', '/detections')

    // Act
    await userEvent.click(await screen.findByRole('button', { name: 'Retour' }))

    // Assert
    await waitFor(() => expect(router.state.location.pathname).toBe('/settings'))
  })

  it('BackButton_ShouldOpenTheHome_WhenTheAppOpenedOnThisPage', async () => {
    // Arrange
    fakeNetwork({ 'GET /api/cameras': ok([]), 'GET /api/system/stats': ok(stats()) })
    const router = openShellAt('/detections')

    // Act
    await userEvent.click(await screen.findByRole('button', { name: 'Retour' }))

    // Assert
    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
  })

  it.each([
    ['/settings', 1],
    ['/detections', 0],
  ])('RestartTrigger_ShouldShowOnlyInTheSettingsBar_WhenAChangeWaits (%s)', async (url, count) => {
    // Arrange
    fakeNetwork({
      'GET /api/cameras': ok([]),
      'GET /api/system/stats': ok(stats({ pendingChanges: true })),
    })

    // Act
    openShellAt(url)

    // Assert
    const bar = await screen.findByRole('banner')
    await waitFor(() => expect(useRootStore.getState().systemStats).not.toBeNull())
    expect(
      within(bar).queryAllByRole('button', { name: 'Appliquer les changements' }),
    ).toHaveLength(count)
  })

  it('TopBar_ShouldGrowWithAnAlert_WhenACameraStopsAnswering', async () => {
    // Arrange
    fakeNetwork({
      'GET /api/cameras': ok([makeCamera({ displayName: 'Jardin', status: 'offline' })]),
      'GET /api/system/stats': ok(stats()),
    })

    // Act
    openShellAt('/')

    // Assert
    const alerts = await screen.findByRole('list', { name: 'Alertes' })
    expect(within(alerts).getByRole('link', { name: /Jardin ne répond plus/ })).toHaveAttribute(
      'href',
      '/cameras/camera-1',
    )
    expect(within(alerts).getByText('Hors ligne depuis moins d’une minute')).toBeVisible()
  })

  it('TopBar_ShouldSayWhichCameraDidNotTurn_WhenARangeCutItAndItDidNotFollow', async () => {
    // Arrange
    fakeNetwork({
      'GET /api/cameras': ok([
        makeCamera({
          displayName: 'Salon',
          privacyModeActive: true,
          privacyModeSource: 'schedule',
          privacyStrategy: PrivacyStrategy.PtzParking,
          privacyMiss: PrivacyMiss.CameraFailed,
        }),
      ]),
      'GET /api/system/stats': ok(stats()),
    })

    // Act
    openShellAt('/')

    // Assert
    const alerts = await screen.findByRole('list', { name: 'Alertes' })
    expect(
      within(alerts).getByRole('link', { name: /Salon : la caméra ne s’est pas tournée/ }),
    ).toHaveAttribute('href', '/cameras/camera-1')
    expect(within(alerts).getByText('Enregistrement désactivé')).toBeVisible()
    expect(
      within(alerts).getByRole('button', {
        name: 'Masquer : Salon : la caméra ne s’est pas tournée',
      }),
    ).toBeEnabled()
  })

  it('cameraList_ShouldRaiseTheMissAgain_WhenItEndedThenCameBack', async () => {
    // Arrange
    const missed = makeCamera({
      privacyModeActive: true,
      privacyStrategy: PrivacyStrategy.PtzParking,
      privacyMiss: PrivacyMiss.CameraFailed,
    })
    const network = fakeNetwork({
      'GET /api/cameras': ok([makeCamera()]),
      'GET /api/system/stats': ok(stats()),
    })
    openShellAt('/')
    await screen.findByText('Accueil')
    act(() =>
      useRootStore.setState({ privacyMissesTold: ['privacy-miss:camera-1:on:camera_failed'] }),
    )
    await act(() => useRootStore.getState().loadCameras(appContainer.cameras.getCameras))
    network.answer('GET /api/cameras', ok([missed]))

    // Act
    await act(() => useRootStore.getState().loadCameras(appContainer.cameras.getCameras))

    // Assert
    expect(
      within(screen.getByRole('list', { name: 'Alertes' })).getByText(
        'Front Door : la caméra ne s’est pas tournée',
      ),
    ).toBeVisible()
  })

  it('TopBar_ShouldDropTheAlert_WhenTheUserSetsItAside', async () => {
    // Arrange
    fakeNetwork({
      'GET /api/cameras': ok([makeCamera({ displayName: 'Jardin', status: 'offline' })]),
      'GET /api/system/stats': ok(stats()),
    })
    openShellAt('/')
    const alerts = await screen.findByRole('list', { name: 'Alertes' })

    // Act
    await userEvent.click(
      within(alerts).getByRole('button', { name: 'Masquer : Jardin ne répond plus' }),
    )

    // Assert
    expect(screen.queryByRole('list', { name: 'Alertes' })).not.toBeInTheDocument()
  })

  it('TopBar_ShouldSayVyzioNoLongerAnswers_WhenTheSystemCannotBeReachedAnyMore', async () => {
    // Arrange
    fakeNetwork({ 'GET /api/cameras': ok([]), 'GET /api/system/stats': ok(stats()) })
    openShellAt('/')
    await waitFor(() => expect(useRootStore.getState().systemStats).not.toBeNull())
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    // Act
    await act(() => useRootStore.getState().loadSystemStats(appContainer.hub.getSystemStats))

    // Assert
    const alerts = await screen.findByRole('list', { name: 'Alertes' })
    expect(within(alerts).getByText('Vyzio ne répond plus')).toBeVisible()
    expect(within(alerts).queryByRole('button', { name: /Masquer/ })).not.toBeInTheDocument()
  })
})
