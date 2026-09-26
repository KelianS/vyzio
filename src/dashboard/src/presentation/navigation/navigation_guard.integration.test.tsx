import { describe, expect, it } from 'vitest'
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Link } from 'react-router'
import type { SystemStats } from '../../domain/entities/system_stats.entity'
import { useRootStore } from '../../infrastructure/store/root.store'
import { failure, fakeNetwork, ok } from '../../testing/fake_network'
import { renderScreen } from '../../testing/render_screen'
import { pollTheSurveillance } from '../../testing/shared_reads'
import { NavigationGuard } from './navigation_guard.component'

const STATS = 'GET /api/system/stats'
const APPLY = 'POST /api/cameras/apply-configuration'
const CONSERVATION = { path: '*', url: '/settings/conservation' }

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
    expect(router.state.location.pathname).toBe('/settings/conservation')
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
    await act(() => router.navigate('/settings/conservation'))

    // Act
    await userEvent.click(screen.getByRole('link', { name: 'Accueil' }))

    // Assert
    const dialog = within(await screen.findByRole('alertdialog'))
    expect(dialog.getByText(/Vyzio a rencontré une erreur/)).toBeInTheDocument()
    expect(dialog.getByText(/POST \/api\/cameras\/apply-configuration · 500/)).toBeVisible()
    expect(dialog.getByRole('button', { name: 'Réessayer' })).toBeInTheDocument()
  })
})
