import { test, expect } from '@playwright/test'
import { installFakeBackend, createFakeBackendState, makeFakeCamera } from './fixtures/fakeBackend'

/**
 * The two-step editing cycle (ADR-41), checked end to end: editing has no effect,
 * confirming is a single gesture, and an edited page is not left silently.
 */
test.describe('Réglages — cycle d’édition', () => {
  test.beforeEach(async ({ page }) => {
    await installFakeBackend(page, createFakeBackendState({ cameras: [makeFakeCamera()] }))
    await page.goto('/settings/conservation')
  })

  test('user_When editing a value_Should see what changed, with nothing saved yet', async ({
    page,
  }) => {
    const bar = page.getByRole('region', { name: 'Modifications en attente' })
    await expect(bar).toBeHidden()

    const motion = page.getByRole('spinbutton').nth(1)
    await motion.fill('30')
    await motion.blur()

    // The draft names the setting touched rather than merely counting it.
    await expect(bar).toBeVisible()
    await expect(bar).toContainText('1 modification')
    await expect(bar).toContainText('Séquences de mouvement')
    // And it announces no interruption: saving does not touch surveillance, it is
    // the restart that interrupts it (ADR-44).
    await expect(bar).not.toContainText('interrompt')

    // Nothing was lost: the reloaded page finds the saved value again.
    await page.reload()
    await expect(page.getByRole('spinbutton').nth(1)).toHaveValue('7')
  })

  test('user_When discarding_Should return the page to its last saved state', async ({ page }) => {
    const motion = page.getByRole('spinbutton').nth(1)
    await motion.fill('30')
    await motion.blur()

    await page.getByRole('button', { name: 'Annuler' }).click()

    await expect(motion).toHaveValue('7')
    await expect(page.getByRole('region', { name: 'Modifications en attente' })).toBeHidden()
  })

  test('user_When saving_Should persist in a single gesture and clear the draft', async ({
    page,
  }) => {
    const motion = page.getByRole('spinbutton').nth(1)
    await motion.fill('30')
    await motion.blur()

    await page.getByRole('button', { name: 'Enregistrer' }).click()

    // A single gesture on the page: the draft is settled, with no second button to
    // look for. The restart is decided elsewhere (ADR-44, redemarrage.e2e.ts).
    await expect(page.getByRole('region', { name: 'Modifications en attente' })).toBeHidden()

    await page.reload()
    await expect(page.getByRole('spinbutton').nth(1)).toHaveValue('30')
  })

  test('user_When leaving a modified page_Should be asked before losing the changes', async ({
    page,
  }) => {
    const motion = page.getByRole('spinbutton').nth(1)
    await motion.fill('30')
    await motion.blur()

    await page
      .getByRole('navigation', { name: 'Rubriques de réglages' })
      .getByRole('link', { name: /Notifications/ })
      .click()

    await expect(page.getByText('Quitter sans enregistrer ?')).toBeVisible()

    // Staying: nothing moves, and what was typed survives.
    await page.getByRole('button', { name: 'Rester sur la page' }).click()
    await expect(page).toHaveURL('/settings/conservation')
    await expect(motion).toHaveValue('30')

    // Leaving: navigation carries on.
    await page
      .getByRole('navigation', { name: 'Rubriques de réglages' })
      .getByRole('link', { name: /Notifications/ })
      .click()
    await page.getByRole('button', { name: 'Quitter sans enregistrer' }).click()
    await expect(page).toHaveURL('/settings/notifications')
  })
})
