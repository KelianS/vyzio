import { test, expect } from '@playwright/test'
import { installFakeBackend, createFakeBackendState, makeFakeCamera } from './fixtures/fake_backend'

// A capability no read can prove is never assumed: the user tries it once and answers (ADR-66).
test.describe('Capability to confirm', () => {
  test('CameraConnectionView_ShouldMakeOrientationWork_WhenTheUserTriesItAndAnswersYes', async ({
    page,
  }) => {
    const state = createFakeBackendState({ cameras: [makeFakeCamera({ ptzSupported: false })] })
    state.ptzBinding = { protocol: 'v380', configJson: null, status: 'to_confirm' }
    await installFakeBackend(page, state)
    await page.goto('/settings/cameras/camera-1/connexion')
    const orientation = page
      .getByRole('list', { name: 'Capacités' })
      .getByRole('listitem')
      .filter({ hasText: 'Orientation' })
    await expect(orientation.getByText('À confirmer')).toBeVisible()

    await orientation.getByRole('button', { name: 'Essayer' }).click()
    await expect(orientation.getByText('La caméra a bougé ?')).toBeVisible()
    await orientation.getByRole('button', { name: 'Oui' }).click()

    await expect(orientation.getByText('Fonctionne')).toBeVisible()
    await expect(orientation.getByText(/^Confirmé par vous le/)).toBeVisible()
    expect(state.ptzBinding.status).toBe('verified')
  })
})
