import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { PrivacyMiss, PrivacyStrategy } from '../../domain/entities/camera.entity'
import { makeCamera } from '../../testing/camera_fixture'
import { failure, fakeNetwork, late, ok } from '../../testing/fake_network'
import { renderScreen } from '../../testing/render_screen'
import { appContainer } from '../../infrastructure/providers/app.container'
import { useRootStore } from '../../infrastructure/store/root.store'
import { AppContainerProvider } from '../../infrastructure/providers/app_container.context'
import { ToastProvider } from '../../common/components/toast'
import { PageHeader } from '../../common/components/page_header'
import type { SystemStats } from '../../domain/entities/system_stats.entity'
import { holdStill, layOut, touchDown, touchMove, touchUp } from '../../testing/finger'
import { withFullMotion } from '../../testing/full_motion'
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

// The real clock still runs underneath, so the screen's own waits keep working.
function usePollClock() {
  vi.useFakeTimers({ shouldAdvanceTime: true })
}

async function aPollPasses() {
  await act(() => vi.advanceTimersByTimeAsync(8000))
}

describe('AppShell', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

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

  it('TopBar_ShouldKeepTheAlertClosed_WhenTheInterfaceIsOpenedAgainOnThisDevice', async () => {
    // Arrange
    fakeNetwork({
      'GET /api/cameras': ok([makeCamera({ displayName: 'Jardin', status: 'offline' })]),
      'GET /api/system/stats': ok(stats()),
    })
    openShellAt('/')
    await userEvent.click(
      within(await screen.findByRole('list', { name: 'Alertes' })).getByRole('button', {
        name: 'Masquer : Jardin ne répond plus',
      }),
    )
    cleanup()

    // Act
    openShellAt('/')

    // Assert
    await waitFor(() => {
      const state = useRootStore.getState()
      expect(state.camerasLoading || state.systemStats === null).toBe(false)
    })
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

  it('TopBar_ShouldSayACameraStoppedAnswering_WhenItGoesOfflineWhileTheHomeIsOpen', async () => {
    // Arrange
    usePollClock()
    const network = fakeNetwork({
      'GET /api/cameras': ok([makeCamera({ displayName: 'Jardin' })]),
      'GET /api/system/stats': ok(stats()),
    })
    openShellAt('/')
    await waitFor(() => expect(useRootStore.getState().cameras).toHaveLength(1))
    network.answer(
      'GET /api/cameras',
      ok([makeCamera({ displayName: 'Jardin', status: 'offline' })]),
    )

    // Act
    await aPollPasses()

    // Assert
    const alerts = await screen.findByRole('list', { name: 'Alertes' })
    expect(within(alerts).getByText('Jardin ne répond plus')).toBeVisible()
  })

  it('TopBar_ShouldDropTheOfflineAlert_WhenTheCameraComesBackWhileTheHomeIsOpen', async () => {
    // Arrange
    usePollClock()
    const network = fakeNetwork({
      'GET /api/cameras': ok([makeCamera({ displayName: 'Jardin', status: 'offline' })]),
      'GET /api/system/stats': ok(stats()),
    })
    openShellAt('/')
    await screen.findByRole('list', { name: 'Alertes' })
    network.answer('GET /api/cameras', ok([makeCamera({ displayName: 'Jardin' })]))

    // Act
    await aPollPasses()

    // Assert
    await waitFor(() =>
      expect(screen.queryByRole('list', { name: 'Alertes' })).not.toBeInTheDocument(),
    )
  })

  it('AppShell_ShouldKeepTheListWithoutAToast_WhenABackgroundReadFails', async () => {
    // Arrange
    usePollClock()
    const network = fakeNetwork({
      'GET /api/cameras': ok([makeCamera({ displayName: 'Jardin', status: 'offline' })]),
      'GET /api/system/stats': ok(stats()),
    })
    openShellAt('/')
    await screen.findByRole('list', { name: 'Alertes' })
    network.answer('GET /api/cameras', failure(500))

    // Act
    await aPollPasses()
    await aPollPasses()

    // Assert
    expect(network.sent.filter((r) => r.route === 'GET /api/cameras')).toHaveLength(3)
    expect(screen.queryByText(/Vyzio a rencontré une erreur/)).not.toBeInTheDocument()
    expect(useRootStore.getState().camerasLoading).toBe(false)
    expect(
      within(screen.getByRole('list', { name: 'Alertes' })).getByText('Jardin ne répond plus'),
    ).toBeVisible()
  })

  it('AppShell_ShouldNotAskForTheListAgain_WhenTheLastBackgroundReadIsStillUnanswered', async () => {
    // Arrange
    usePollClock()
    const network = fakeNetwork({
      'GET /api/cameras': ok([makeCamera()]),
      'GET /api/system/stats': ok(stats()),
    })
    openShellAt('/')
    await waitFor(() => expect(useRootStore.getState().cameras).toHaveLength(1))
    network.answer('GET /api/cameras', late(ok([makeCamera()]), 20_000))

    // Act
    await aPollPasses()
    await aPollPasses()

    // Assert
    expect(network.sent.filter((r) => r.route === 'GET /api/cameras')).toHaveLength(2)
  })

  it('AppShell_ShouldKeepTheShownListAsItIs_WhenABackgroundReadBringsNothingNew', async () => {
    // Arrange
    usePollClock()
    fakeNetwork({ 'GET /api/cameras': ok([makeCamera()]), 'GET /api/system/stats': ok(stats()) })
    openShellAt('/')
    await waitFor(() => expect(useRootStore.getState().cameras).toHaveLength(1))
    const shown = useRootStore.getState().cameras

    // Act
    await aPollPasses()

    // Assert
    expect(useRootStore.getState().cameras).toBe(shown)
  })

  it('AppShell_ShouldKeepTheNewerList_WhenAReloadAnswersBeforeAnOlderBackgroundRead', async () => {
    // Arrange
    usePollClock()
    const network = fakeNetwork({
      'GET /api/cameras': ok([makeCamera({ displayName: 'Jardin' })]),
      'GET /api/system/stats': ok(stats()),
    })
    openShellAt('/')
    await waitFor(() => expect(useRootStore.getState().cameras).toHaveLength(1))
    network.answer('GET /api/cameras', late(ok([makeCamera({ displayName: 'Jardin' })]), 4000))
    await aPollPasses()
    network.answer(
      'GET /api/cameras',
      ok([makeCamera({ displayName: 'Jardin', status: 'offline' })]),
    )
    await act(() => useRootStore.getState().loadCameras(appContainer.cameras.getCameras))

    // Act
    await act(() => vi.advanceTimersByTimeAsync(4000))

    // Assert
    expect(
      within(screen.getByRole('list', { name: 'Alertes' })).getByText('Jardin ne répond plus'),
    ).toBeVisible()
  })
})

describe('AppShell motion', () => {
  /** The shell open on the home, its reads answered. */
  async function openTheHome() {
    fakeNetwork({ 'GET /api/cameras': ok([]), 'GET /api/system/stats': ok(stats()) })
    const router = openShellAt('/')
    await screen.findByText('Accueil')
    return router
  }

  /** The page under the bar, which slides; the bar is the banner above it. */
  function stage() {
    return screen.getByRole('banner').nextElementSibling as HTMLElement
  }

  /** How far a `translate3d` moves sideways, in pixels. */
  function shiftOf(transform: string): number {
    return Number(/translate3d\((-?[\d.]+)px/.exec(transform)?.[1] ?? Number.NaN)
  }

  function copiesLeftBehind() {
    return [...document.body.children]
      .filter((node): node is HTMLElement => node instanceof HTMLElement)
      .filter((node) => node.getAttribute('aria-hidden') === 'true')
  }

  it('TopBar_ShouldStayInPlaceWhileOnlyItsContentsMoveVertically_WhenAPageOpens', async () => {
    // Arrange
    withFullMotion()
    const router = await openTheHome()

    // Act
    await act(() => router.navigate('/detections'))

    // Assert
    const bar = screen.getByRole('banner')
    expect(bar.style.transform).toBe('')
    const contents = screen
      .getByRole('button', { name: 'Retour' })
      .closest('[style]') as HTMLElement
    expect(contents.style.transform).toBe('translate3d(0px, 16px, 0px)')
    expect(stage().style.transform).toBe(`translate3d(${window.innerWidth}px, 0px, 0px)`)
    expect(copiesLeftBehind().some((copy) => copy.textContent?.includes('Vyzio'))).toBe(true)
    await waitFor(() => expect(stage().style.transform).toBe(''))
    expect(contents.style.transform).toBe('')
  })

  it('PageTransition_ShouldGoBackFromWhereThePageStands_WhenBackIsTappedWhileItSlidesIn', async () => {
    // Arrange
    withFullMotion()
    const router = await openTheHome()
    await act(() => router.navigate('/detections'))
    await new Promise((resolve) => setTimeout(resolve, 80))
    const midway = stage().style.transform

    // Act
    await act(() => router.navigate(-1))

    // Assert
    const leaving = copiesLeftBehind().find((copy) => copy.style.zIndex === '30')
    const from = shiftOf(leaving?.style.transform ?? '')
    // A frame or two may pass between the two reads; a jump would land at an end.
    expect(shiftOf(midway)).toBeGreaterThan(0)
    expect(Math.abs(from - shiftOf(midway))).toBeLessThan(window.innerWidth / 10)
  })

  it('PageTransition_ShouldOnlyFadeTheNewPageIn_WhenThePhoneAsksForLessMotion', async () => {
    // Arrange
    const router = await openTheHome()

    // Act
    await act(() => router.navigate('/detections'))

    // Assert
    expect(stage().style.transform).toBe('')
    expect(stage().style.opacity).toBe('0')
    expect(copiesLeftBehind()).toHaveLength(0)
    await waitFor(() => expect(stage().style.opacity).toBe(''))
  })

  describe('a swiped alert', () => {
    let restoreLayout = () => {}
    beforeEach(() => {
      restoreLayout = layOut(320, 60)
    })
    afterEach(() => restoreLayout())

    async function theOfflineAlert() {
      fakeNetwork({
        'GET /api/cameras': ok([makeCamera({ displayName: 'Jardin', status: 'offline' })]),
        'GET /api/system/stats': ok(stats()),
      })
      openShellAt('/')
      const alerts = await screen.findByRole('list', { name: 'Alertes' })
      return within(alerts).getByText('Jardin ne répond plus').closest('li') as HTMLElement
    }

    it('BarAlert_ShouldFollowTheFingerOneToOne_WhenSwipedSideways', async () => {
      // Arrange
      const alert = await theOfflineAlert()

      // Act
      touchDown(alert, 100, 20)
      touchMove(alert, 115, 20)
      touchMove(alert, 175, 20)

      // Assert
      expect(alert.style.transform).toBe('translate3d(60px, 0px, 0px)')
    })

    it('BarAlert_ShouldStayAsideOnThisDevice_WhenAFlickThrowsItAway', async () => {
      // Arrange
      const alert = await theOfflineAlert()

      // Act
      touchDown(alert, 100, 20)
      touchMove(alert, 115, 20)
      touchMove(alert, 145, 20)
      touchUp(alert, 145, 20)

      // Assert
      await waitFor(() =>
        expect(screen.queryByRole('list', { name: 'Alertes' })).not.toBeInTheDocument(),
      )
      expect(localStorage.getItem('vyzio.bar-alerts.dismissed')).toContain('offline')
    })

    it('BarAlert_ShouldComeBack_WhenReleasedSlowlyBeforeItIsThrownFarEnough', async () => {
      // Arrange
      const alert = await theOfflineAlert()
      touchDown(alert, 100, 20)
      touchMove(alert, 115, 20)
      touchMove(alert, 175, 20)
      await holdStill()

      // Act
      touchUp(alert, 175, 20)

      // Assert
      await waitFor(() => expect(alert.style.transform).toBe(''))
      expect(screen.getByRole('list', { name: 'Alertes' })).toBeInTheDocument()
    })

    it('BarAlert_ShouldNotMove_WhenVyzioNoLongerAnswers', async () => {
      // Arrange
      fakeNetwork({ 'GET /api/cameras': ok([]), 'GET /api/system/stats': ok(stats()) })
      openShellAt('/')
      await waitFor(() => expect(useRootStore.getState().systemStats).not.toBeNull())
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
      await act(() => useRootStore.getState().loadSystemStats(appContainer.hub.getSystemStats))
      const alerts = await screen.findByRole('list', { name: 'Alertes' })
      const alert = within(alerts).getByText('Vyzio ne répond plus').closest('li') as HTMLElement

      // Act
      touchDown(alert, 100, 20)
      touchMove(alert, 115, 20)
      touchMove(alert, 300, 20)
      touchUp(alert, 300, 20)

      // Assert
      expect(alert.style.transform).toBe('')
      expect(within(alerts).getByText('Vyzio ne répond plus')).toBeVisible()
    })
  })
})
