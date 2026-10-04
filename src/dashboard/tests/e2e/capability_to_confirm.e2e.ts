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
  test('CameraConnectionView_ShouldRememberTheNoAndAskAgainOnlyOnPurpose_WhenTheUserAnswersNo', async ({
    page,
  }) => {
    const state = createFakeBackendState({ cameras: [makeFakeCamera({ ptzSupported: false })] })
    state.ptzBinding = { protocol: 'dvrip', configJson: null, status: 'to_confirm' }
    await installFakeBackend(page, state)
    await page.goto('/settings/cameras/camera-1/connexion')
    const orientation = page
      .getByRole('list', { name: 'Capacités' })
      .getByRole('listitem')
      .filter({ hasText: 'Orientation' })

    await orientation.getByRole('button', { name: 'Essayer' }).click()
    await orientation.getByRole('button', { name: 'Non' }).click()
    await expect(
      orientation.getByText('Vous avez indiqué que la caméra n’a pas bougé.'),
    ).toBeVisible()
    await page.reload()
    await expect(
      orientation.getByText('Vous avez indiqué que la caméra n’a pas bougé.'),
    ).toBeVisible()

    await orientation.getByRole('button', { name: 'Essayer à nouveau' }).click()
    await expect(orientation.getByText('La caméra a bougé ?')).toBeVisible()
    await orientation.getByRole('button', { name: 'Oui' }).click()

    await expect(orientation.getByText(/^Confirmé par vous le/)).toBeVisible()
    expect(state.ptzBinding.status).toBe('verified')
  })

  test('LiveView_ShouldOfferTheJoystick_WhenTheUserConfirmsTheOrientationThroughTheLine', async ({
    page,
  }) => {
    const state = createFakeBackendState({ cameras: [makeFakeCamera({ ptzSupported: true })] })
    state.ptzBinding = { protocol: 'v380', configJson: null, status: 'to_confirm' }
    await installFakeBackend(page, state)
    await page.goto('/')
    await page.getByRole('button', { name: 'Porte d’entrée' }).click()
    await expect(page.getByText(/L’orientation n’est pas disponible pour le moment/)).toBeVisible()
    await expect(page.getByTitle('Haut')).toHaveCount(0)

    await page.getByRole('link', { name: 'Connexion' }).click()
    const orientation = page
      .getByRole('list', { name: 'Capacités' })
      .getByRole('listitem')
      .filter({ hasText: 'Orientation' })
    await orientation.getByRole('button', { name: 'Essayer' }).click()
    await orientation.getByRole('button', { name: 'Oui' }).click()
    await expect(orientation.getByText('Fonctionne')).toBeVisible()

    await page.getByRole('link', { name: 'Accueil' }).click()
    await page.getByRole('button', { name: 'Porte d’entrée' }).click()
    await expect(page.getByTitle('Haut')).toBeVisible()
  })
})
