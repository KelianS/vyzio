import { test, expect } from '@playwright/test'
import { installFakeBackend, createFakeBackendState, makeFakeCamera } from './fixtures/fakeBackend'

/**
 * Le cycle d'edition en deux temps (ADR-41), verifie de bout en bout : modifier
 * n'a aucun effet, valider est un seul geste, et une page modifiee ne se quitte
 * pas en silence.
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

    // Le brouillon nomme le reglage touche plutot que de seulement le compter.
    await expect(bar).toBeVisible()
    await expect(bar).toContainText('1 modification')
    await expect(bar).toContainText('Séquences de mouvement')
    // Et il n'annonce aucune interruption : enregistrer ne touche pas la
    // surveillance, c'est le redemarrage qui l'interrompt (ADR-44).
    await expect(bar).not.toContainText('interrompt')

    // Rien n'est parti : la page rechargee retrouve la valeur enregistree.
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

    // Un seul geste sur la page : le brouillon est solde, sans second bouton a
    // chercher. Le redemarrage se decide ailleurs (ADR-44, redemarrage.e2e.ts).
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

    // Rester : on ne bouge pas, et la saisie survit.
    await page.getByRole('button', { name: 'Rester sur la page' }).click()
    await expect(page).toHaveURL('/settings/conservation')
    await expect(motion).toHaveValue('30')

    // Quitter : la navigation se poursuit.
    await page
      .getByRole('navigation', { name: 'Rubriques de réglages' })
      .getByRole('link', { name: /Notifications/ })
      .click()
    await page.getByRole('button', { name: 'Quitter sans enregistrer' }).click()
    await expect(page).toHaveURL('/settings/notifications')
  })
})
