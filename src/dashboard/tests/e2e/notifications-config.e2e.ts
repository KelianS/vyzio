import { test, expect } from '@playwright/test'
import { installFakeBackend, createFakeBackendState } from './fixtures/fakeBackend'

test.describe('Notifications — canal Telegram', () => {
  test('user_When configuring and enabling the channel_Should be warned before data leaves', async ({
    page,
  }) => {
    await installFakeBackend(page, createFakeBackendState())

    await page.goto('/settings/notifications')
    await expect(page.getByText('Pas encore configuré.')).toBeVisible()

    await page.getByRole('textbox', { name: 'Clé du bot' }).fill('123456:ABCDEF')
    await page.getByRole('textbox', { name: 'Identifiant de conversation' }).fill('987654321')
    await page.getByRole('switch', { name: 'Alertes Telegram' }).click()

    await page.getByRole('button', { name: 'Enregistrer' }).click()

    // Invariant vie privee : les images quittent le reseau local, on le dit
    // avant, pas apres.
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toContainText('serveurs de Telegram')
    await dialog.getByRole('button', { name: 'Activer' }).click()

    await expect(page.getByText('Les alertes sont envoyées.')).toBeVisible()

    await page.getByRole('button', { name: 'Envoyer un message de test' }).click()
    await expect(page.getByText('Message envoyé : le canal fonctionne.')).toBeVisible()
  })

  test('user_When nothing is configured_Should not be able to send a test', async ({ page }) => {
    await installFakeBackend(page, createFakeBackendState())
    await page.goto('/settings/notifications')

    // Tester sans canal enverrait vers nulle part : le bouton le dit au lieu
    // de laisser essayer.
    await expect(page.getByRole('button', { name: 'Envoyer un message de test' })).toBeDisabled()
  })

  test('user_When restricting hours_Should only then be asked which ones', async ({ page }) => {
    await installFakeBackend(page, createFakeBackendState())
    await page.goto('/settings/notifications')

    // Les heures n'existent que si la plage est demandee : les montrer grisees
    // ferait deux reglages la ou l'utilisateur n'en decide qu'un.
    await expect(page.getByRole('combobox', { name: 'À partir de' })).toHaveCount(0)
    await page.getByRole('switch', { name: 'Seulement à certaines heures' }).click()
    await expect(page.getByRole('combobox', { name: 'À partir de' })).toBeVisible()
  })
})
