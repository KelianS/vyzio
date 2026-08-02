import { test, expect } from '@playwright/test'
import { installFakeBackend, createFakeBackendState, makeFakeCamera } from './fixtures/fakeBackend'

test.describe('Navigation', () => {
  test('user_When visiting the app_Should reach every screen from the header without errors', async ({
    page,
  }) => {
    // A missing notification channel config is a normal "not configured yet" signal the app
    // handles via a caught 404 (HttpNotificationSettingsRepository.getChannelConfig) — not a bug,
    // just a browser-level network log we don't want polluting this assertion.
    const isExpectedNoise = (text: string) => text.includes('/api/notifications/settings/telegram')

    const consoleErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const entry = `${msg.text()} @ ${msg.location().url}`
        if (!isExpectedNoise(entry)) consoleErrors.push(entry)
      }
    })
    page.on('pageerror', (err) => consoleErrors.push(err.message))

    await installFakeBackend(page, createFakeBackendState({ cameras: [makeFakeCamera()] }))

    const nav = page.locator('.app-header-nav')

    await page.goto('/')
    await expect(
      page.locator('.hub-status-bar, .hub-setup-hero, .hub-degraded-panel'),
    ).toBeVisible()

    await nav.getByRole('link', { name: 'Paramètres', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Decouverte guidee' })).toBeVisible()

    await nav.getByRole('link', { name: 'Profils', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Gestion des personnes connues' })).toBeVisible()

    await nav.getByRole('link', { name: 'Alertes', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Configuration des alertes' })).toBeVisible()

    await nav.getByRole('link', { name: 'Historique', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Historique des detections' })).toBeVisible()

    await nav.getByRole('link', { name: 'Expert', exact: true }).click()
    await expect(page.locator('.expert-shell, .expert-error-panel')).toBeVisible()

    await nav.getByRole('link', { name: 'Accueil', exact: true }).click()
    await expect(page).toHaveURL('/')

    expect(consoleErrors, `Console errors while navigating:\n${consoleErrors.join('\n')}`).toEqual(
      [],
    )
  })
})
