import { describe, expect, it } from 'vitest'
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { SystemStats } from '../../domain/entities/system_stats.entity'
import { appContainer } from '../../infrastructure/providers/app.container'
import { useRootStore } from '../../infrastructure/store/root.store'
import { failure, fakeNetwork, ok } from '../../testing/fake_network'
import { renderScreen } from '../../testing/render_screen'
import { RestartSurveillanceTrigger } from './restart_surveillance_trigger.component'

function stats(pendingChanges: boolean): SystemStats {
  return {
    status: 'active',
    storage: null,
    cameras: [],
    detection: { hardware: 'cpu', targetFps: 5 },
    pendingChanges,
  }
}

// What the header's background poll does, through the same network.
async function pollTheSurveillance() {
  await act(() => useRootStore.getState().loadSystemStats(appContainer.hub.getSystemStats))
}

describe('RestartSurveillanceTrigger', () => {
  it('onRestart_ShouldApplyTheChangesAndDisappear_WhenTheUserConfirms', async () => {
    // Arrange
    const network = fakeNetwork({
      'GET /api/system/stats': ok(stats(true)),
      'POST /api/cameras/apply-configuration': ok({
        applied: true,
        message: 'ok',
        configPath: '/config/config.yml',
        cameraCount: 1,
      }),
    })
    renderScreen(<RestartSurveillanceTrigger />)
    await pollTheSurveillance()
    await userEvent.click(screen.getByRole('button', { name: 'Appliquer les changements' }))
    network.answer('GET /api/system/stats', ok(stats(false)))

    // Act
    await userEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Redémarrer' }),
    )

    // Assert
    await waitFor(() => expect(screen.queryByRole('button')).toBeNull())
    expect(network.sent.map((request) => request.route)).toContain(
      'POST /api/cameras/apply-configuration',
    )
  })

  it('onRestart_ShouldAskAgainSayingWhyItFailed_WhenTheLastRestartFailed', async () => {
    // Arrange
    fakeNetwork({
      'GET /api/system/stats': ok(stats(true)),
      'POST /api/cameras/apply-configuration': failure(500),
    })
    renderScreen(<RestartSurveillanceTrigger />)
    await pollTheSurveillance()
    await userEvent.click(screen.getByRole('button', { name: 'Appliquer les changements' }))
    await userEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Redémarrer' }),
    )

    // Act
    await userEvent.click(await screen.findByRole('button', { name: 'Redémarrage échoué' }))

    // Assert
    const question = screen.getByRole('alertdialog')
    expect(question).toHaveTextContent('Vyzio a rencontré une erreur')
    expect(question).toHaveTextContent('POST /api/cameras/apply-configuration · 500')
    expect(within(question).getByRole('button', { name: 'Réessayer' })).toBeEnabled()
  })

  it('render_ShouldShowNothing_WhenNoChangeIsWaiting', async () => {
    // Arrange
    fakeNetwork({ 'GET /api/system/stats': ok(stats(false)) })
    renderScreen(<RestartSurveillanceTrigger />)

    // Act
    await pollTheSurveillance()

    // Assert
    expect(screen.queryByRole('button')).toBeNull()
  })
})
