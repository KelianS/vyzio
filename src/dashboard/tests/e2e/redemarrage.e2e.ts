import { test, expect } from '@playwright/test'
import { installFakeBackend, createFakeBackendState, makeFakeCamera } from './fixtures/fakeBackend'

/**
 * Redemarrer la surveillance est un acte de l'utilisateur (ADR-44) : enregistrer
 * n'interrompt rien, l'attente se voit et se nomme, et la question ne se pose
 * qu'en quittant les reglages.
 */
test.describe('Redémarrage de la surveillance', () => {
  const trigger = (name = /Redémarrer la surveillance/) => ({ name })

  test('user_When nothing was changed_Should not be offered a restart at all', async ({ page }) => {
    await installFakeBackend(page, createFakeBackendState({ cameras: [makeFakeCamera()] }))
    await page.goto('/settings/conservation')

    // L'absence du declencheur est une information : tout ce qui est enregistre
    // est en service.
    await expect(page.getByRole('button', trigger())).toHaveCount(0)
  })

  test('user_When saving a setting_Should be told what waits, without anything being interrupted', async ({
    page,
  }) => {
    await installFakeBackend(page, createFakeBackendState({ cameras: [makeFakeCamera()] }))
    await page.goto('/settings/conservation')

    const motion = page.getByRole('spinbutton').nth(1)
    await motion.fill('30')
    await motion.blur()

    const bar = page.getByRole('region', { name: 'Modifications en attente' })
    await expect(bar).not.toContainText('interrompt')
    await page.getByRole('button', { name: 'Enregistrer' }).click()

    await expect(page.getByRole('button', trigger())).toBeVisible()
  })

  test('user_When restarting from the header_Should confirm, then see the wait clear', async ({
    page,
  }) => {
    const state = createFakeBackendState({ cameras: [makeFakeCamera()] })
    state.pendingChanges = ['detection', 'retention']
    await installFakeBackend(page, state)
    await page.goto('/settings/conservation')

    await page.getByRole('button', trigger()).click()

    // Ce qui attend est nomme, et le cout est dit avant d'agir.
    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText('Détection et Conservation attendent le redémarrage.')
    await expect(dialog).toContainText('La surveillance s’interrompt quelques secondes.')

    await dialog.getByRole('button', { name: 'Redémarrer' }).click()
    await expect(page.getByRole('button', trigger())).toHaveCount(0)
  })

  test('user_When the restart fails_Should keep saying so instead of forgetting it', async ({
    page,
  }) => {
    const state = createFakeBackendState({ cameras: [makeFakeCamera()] })
    state.pendingChanges = ['detection']
    state.restartFails = true
    await installFakeBackend(page, state)
    await page.goto('/settings/conservation')

    await page.getByRole('button', trigger()).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Redémarrer' }).click()

    // Vyzio et la surveillance divergent : le dire une fois puis l'oublier
    // laisserait croire que les reglages sont repris.
    const failed = page.getByRole('button', { name: /Redémarrage échoué/ })
    await expect(failed).toBeVisible()
    await page.getByRole('link', { name: 'Accueil' }).click()
    await expect(failed).toBeVisible()
  })

  test('user_When moving between two settings pages_Should not be asked anything', async ({
    page,
  }) => {
    const state = createFakeBackendState({ cameras: [makeFakeCamera()] })
    state.pendingChanges = ['detection']
    await installFakeBackend(page, state)
    await page.goto('/settings/cameras/camera-1/detection')

    // Le geste le plus courant quand on regle : poser la question ici serait du
    // harcelement, et s'empilerait avec la confirmation de brouillon.
    await page.getByRole('link', { name: 'Conservation', exact: true }).click()
    await expect(page).toHaveURL('/settings/cameras/camera-1/conservation')
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })

  test('user_When leaving the settings_Should be asked, and let through either way', async ({
    page,
  }) => {
    const state = createFakeBackendState({ cameras: [makeFakeCamera()] })
    state.pendingChanges = ['detection']
    await installFakeBackend(page, state)
    await page.goto('/settings/conservation')

    await page.getByRole('link', { name: 'Accueil' }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText('Redémarrer la surveillance maintenant ?')

    // « Plus tard » laisse partir : l'ecart est autorise, rien n'oblige a
    // reconcilier tout de suite.
    await dialog.getByRole('button', { name: 'Plus tard' }).click()
    await expect(page).toHaveURL('/')
    await expect(page.getByRole('button', trigger())).toBeVisible()
  })
})
