import { test, expect } from '@playwright/test'
import { installFakeBackend, createFakeBackendState } from './fixtures/fakeBackend'

test.describe('Notifications — Telegram channel', () => {
  test('user_When configuring and enabling the Telegram channel_Should confirm and mark it active', async ({
    page,
  }) => {
    await installFakeBackend(page, createFakeBackendState())

    await page.goto('/notifications')
    await expect(page.getByRole('heading', { name: 'Configuration des alertes' })).toBeVisible()
    await expect(page.getByText('Aucun canal configure')).toBeVisible()

    await page.getByLabel('Token du bot').fill('123456:ABCDEF')
    await page.getByLabel('Chat ID').fill('987654321')
    await page.getByLabel('Activer les notifications Telegram').check()

    await page.getByRole('button', { name: 'Enregistrer', exact: true }).click()

    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByRole('dialog')).toContainText('Activer les notifications Telegram')
    await page.getByRole('button', { name: 'Activer Telegram' }).click()

    await expect(page.getByText('Telegram actif')).toBeVisible()

    await page.getByRole('button', { name: 'Tester le canal' }).click()
    await expect(page.getByText('Message test envoye avec succes.')).toBeVisible()
  })
})
