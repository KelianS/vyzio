import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Link } from 'react-router'
import type { SystemStats } from '../../domain/entities/system_stats.entity'
import { useRootStore } from '../../infrastructure/store/root.store'
import { failure, fakeNetwork, ok } from '../../testing/fake_network'
import { renderScreen } from '../../testing/render_screen'
import { pollTheSurveillance } from '../../testing/shared_reads'
import { NavigationGuard } from './navigation_guard.component'
import { TabBar } from '../../common/components/tab_bar'
import { layOut, touchDown, touchMove, touchUp } from '../../testing/finger'
import { withFullMotion } from '../../testing/full_motion'

const STATS = 'GET /api/system/stats'
const APPLY = 'POST /api/cameras/apply-configuration'
const CONSERVATION = { path: '*', url: '/settings/retention' }

const applied = { applied: true, message: 'ok', configPath: '/config/config.yml', cameraCount: 1 }

function stats(pendingChanges: boolean): SystemStats {
  return {
    status: 'active',
    storage: null,
    cameras: [],
    detection: { hardware: 'cpu', targetFps: 5 },
    pendingChanges,
  }
}

function renderGuard() {
  return renderScreen(
    <>
      <NavigationGuard />
      <Link to="/">Accueil</Link>
      <Link to="/settings/notifications">Notifications</Link>
      <Link to="/cameras/camera-1">Direct</Link>
    </>,
    CONSERVATION,
  )
}

describe('NavigationGuard', () => {
  it('NavigationGuard_ShouldLetThrough_WhenNothingIsUnsavedOrPending', async () => {
    // Arrange
    fakeNetwork({})
    const { router } = renderGuard()

    // Act
    await userEvent.click(screen.getByRole('link', { name: 'Accueil' }))

    // Assert
    expect(router.state.location.pathname).toBe('/')
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('NavigationGuard_ShouldLetThrough_WhenThePageClearsItsEditsAndLeavesAtOnce', async () => {
    // Arrange
    fakeNetwork({})
    const { router } = renderGuard()
    act(() => useRootStore.getState().setUnsavedChanges(true))

    // Act
    await act(async () => {
      useRootStore.getState().setUnsavedChanges(false)
      await router.navigate('/')
    })

    // Assert
    expect(router.state.location.pathname).toBe('/')
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('NavigationGuard_ShouldKeepThePage_WhenTheUserStaysWithUnsavedEdits', async () => {
    // Arrange
    fakeNetwork({})
    const { router } = renderGuard()
    act(() => useRootStore.getState().setUnsavedChanges(true))
    await userEvent.click(screen.getByRole('link', { name: 'Accueil' }))

    // Act
    await userEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Rester sur la page' }),
    )

    // Assert
    expect(router.state.location.pathname).toBe('/settings/retention')
  })

  it('NavigationGuard_ShouldLeave_WhenTheUserDropsTheUnsavedEdits', async () => {
    // Arrange
    fakeNetwork({})
    const { router } = renderGuard()
    act(() => useRootStore.getState().setUnsavedChanges(true))
    await userEvent.click(screen.getByRole('link', { name: 'Accueil' }))

    // Act
    await userEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', {
        name: 'Quitter sans enregistrer',
      }),
    )

    // Assert
    expect(router.state.location.pathname).toBe('/')
  })

  it('NavigationGuard_ShouldAskNothing_WhenARestartIsPendingAndTheUserStaysInTheSettings', async () => {
    // Arrange
    fakeNetwork({ [STATS]: ok(stats(true)) })
    const { router } = renderGuard()
    await pollTheSurveillance()

    // Act
    await userEvent.click(screen.getByRole('link', { name: 'Notifications' }))

    // Assert
    expect(router.state.location.pathname).toBe('/settings/notifications')
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('NavigationGuard_ShouldAskNothing_WhenARestartIsPendingAndTheUserDrivesACameraFromTheSettings', async () => {
    // Arrange
    fakeNetwork({ [STATS]: ok(stats(true)) })
    const { router } = renderGuard()
    await pollTheSurveillance()

    // Act
    await userEvent.click(screen.getByRole('link', { name: 'Direct' }))

    // Assert
    expect(router.state.location.pathname).toBe('/cameras/camera-1')
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('NavigationGuard_ShouldLetThroughWithoutRestarting_WhenTheUserAnswersLater', async () => {
    // Arrange
    const network = fakeNetwork({ [STATS]: ok(stats(true)) })
    const { router } = renderGuard()
    await pollTheSurveillance()
    await userEvent.click(screen.getByRole('link', { name: 'Accueil' }))

    // Act
    await userEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Plus tard' }),
    )

    // Assert
    expect(router.state.location.pathname).toBe('/')
    expect(network.sent).not.toContainEqual(expect.objectContaining({ route: APPLY }))
  })

  it('NavigationGuard_ShouldRestartAndLetThrough_WhenTheUserConfirmsOnTheWayOut', async () => {
    // Arrange
    const network = fakeNetwork({ [STATS]: ok(stats(true)), [APPLY]: ok(applied) })
    const { router } = renderGuard()
    await pollTheSurveillance()
    await userEvent.click(screen.getByRole('link', { name: 'Accueil' }))

    // Act
    await userEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Redémarrer' }),
    )

    // Assert
    expect(router.state.location.pathname).toBe('/')
    expect(network.sent).toContainEqual(expect.objectContaining({ route: APPLY }))
  })

  it('NavigationGuard_ShouldSayTheRestartFailedAndOfferARetry_WhenTheLastRestartFailed', async () => {
    // Arrange
    fakeNetwork({ [STATS]: ok(stats(true)), [APPLY]: failure(500) })
    const { router } = renderGuard()
    await pollTheSurveillance()
    await userEvent.click(screen.getByRole('link', { name: 'Accueil' }))
    await userEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Redémarrer' }),
    )
    await waitFor(() => expect(useRootStore.getState().restartFailure).not.toBeNull())
    await act(() => router.navigate('/settings/retention'))

    // Act
    await userEvent.click(screen.getByRole('link', { name: 'Accueil' }))

    // Assert
    const dialog = within(await screen.findByRole('alertdialog'))
    expect(dialog.getByText(/Vyzio a rencontré une erreur/)).toBeInTheDocument()
    expect(dialog.getByText(/POST \/api\/cameras\/apply-configuration · 500/)).toBeVisible()
    expect(dialog.getByRole('button', { name: 'Réessayer' })).toBeInTheDocument()
  })
})

describe('NavigationGuard over the tabs of a camera', () => {
  const CAMERA = '/settings/cameras/camera-1'
  let restoreLayout = () => {}
  beforeEach(() => {
    withFullMotion()
    restoreLayout = layOut(360, 44)
  })
  afterEach(() => restoreLayout())

  /** A camera's settings open on Connexion with an edit not saved yet. */
  function editTheConnection() {
    fakeNetwork({})
    const { router } = renderScreen(
      <>
        <NavigationGuard />
        <TabBar
          label="Réglages de la caméra"
          tabs={[
            { to: `${CAMERA}/connection`, label: 'Connexion' },
            { to: `${CAMERA}/privacy`, label: 'Vie privée' },
          ]}
        >
          <p>Réglages de connexion</p>
        </TabBar>
      </>,
      { path: `${CAMERA}/:tab`, url: `${CAMERA}/connection` },
    )
    act(() => useRootStore.getState().setUnsavedChanges(true))
    const content = screen.getByText('Réglages de connexion').parentElement as HTMLElement
    return { router, content }
  }

  async function stayOnThePage() {
    await userEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: 'Rester sur la page',
      }),
    )
  }

  function copiesLeftOnThePage() {
    return document.body.querySelectorAll(':scope > [inert]')
  }

  it('TabBar_ShouldLeaveThePageAsItWas_WhenASwipedTabChangeIsRefusedToKeepTheEdits', async () => {
    // Arrange
    const { router, content } = editTheConnection()
    touchDown(content, 300, 100)
    touchMove(content, 285, 100)
    touchMove(content, 240, 100)
    touchUp(content, 240, 100)

    // Act
    await stayOnThePage()

    // Assert
    expect(router.state.location.pathname).toBe(`${CAMERA}/connection`)
    await waitFor(() => expect(content.style.transform).toBe(''))
    expect(copiesLeftOnThePage()).toHaveLength(0)
  })

  it('TabBar_ShouldLeaveNoCopyOverTheForm_WhenATappedTabChangeIsRefusedToKeepTheEdits', async () => {
    // Arrange
    const { router } = editTheConnection()
    await userEvent.click(screen.getByRole('link', { name: 'Vie privée' }))

    // Act
    await stayOnThePage()

    // Assert
    expect(router.state.location.pathname).toBe(`${CAMERA}/connection`)
    await waitFor(() => expect(copiesLeftOnThePage()).toHaveLength(0))
  })
})
