import { test, expect } from '@playwright/test'
import { installFakeBackend, createFakeBackendState, makeFakeCamera } from './fixtures/fakeBackend'

// Restarting is the user's act (ADR-44): saving interrupts nothing, and the question is only asked on the way out.
test.describe('Redémarrage de la surveillance', () => {
  const trigger = (name = /Redémarrer la surveillance/) => ({ name })

  test('user_When nothing was changed_Should not be offered a restart at all', async ({ page }) => {
    await installFakeBackend(page, createFakeBackendState({ cameras: [makeFakeCamera()] }))
    await page.goto('/settings/conservation')

    // Its absence is the information: everything saved is in service.
    await expect(page.getByRole('button', trigger())).toHaveCount(0)
  })

  test('user_When saving a setting_Should be offered a restart, without anything being interrupted', async ({
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
    state.pendingChanges = true
    await installFakeBackend(page, state)
    await page.goto('/settings/conservation')

    await page.getByRole('button', trigger()).click()

    // The cost is stated before acting.
    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText('La surveillance s’interrompt quelques secondes.')

    await dialog.getByRole('button', { name: 'Redémarrer' }).click()
    await expect(page.getByRole('button', trigger())).toHaveCount(0)
  })

  test('user_When the restart fails_Should keep saying so instead of forgetting it', async ({
    page,
  }) => {
    const state = createFakeBackendState({ cameras: [makeFakeCamera()] })
    state.pendingChanges = true
    state.restartFails = true
    await installFakeBackend(page, state)
    await page.goto('/settings/conservation')

    await page.getByRole('button', trigger()).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Redémarrer' }).click()

    // Saying it once then forgetting would let the user believe the settings were taken up.
    const failed = page.getByRole('button', { name: /Redémarrage échoué/ })
    await expect(failed).toBeVisible()
    await page.getByRole('link', { name: 'Accueil' }).click()
    await expect(failed).toBeVisible()
  })

  test('user_When moving between two settings pages_Should not be asked anything', async ({
    page,
  }) => {
    const state = createFakeBackendState({ cameras: [makeFakeCamera()] })
    state.pendingChanges = true
    await installFakeBackend(page, state)
    await page.goto('/settings/cameras/camera-1/detection')

    // The most common gesture while configuring: asking here would nag, and stack with the draft guard.
    await page.getByRole('link', { name: 'Conservation', exact: true }).click()
    await expect(page).toHaveURL('/settings/cameras/camera-1/conservation')
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })

  test('user_When leaving the settings_Should be asked, and let through either way', async ({
    page,
  }) => {
    const state = createFakeBackendState({ cameras: [makeFakeCamera()] })
    state.pendingChanges = true
    await installFakeBackend(page, state)
    await page.goto('/settings/conservation')

    await page.getByRole('link', { name: 'Accueil' }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText('Redémarrer la surveillance maintenant ?')

    // « Plus tard » lets through too: the gap is allowed.
    await dialog.getByRole('button', { name: 'Plus tard' }).click()
    await expect(page).toHaveURL('/')
    await expect(page.getByRole('button', trigger())).toBeVisible()
  })
})
