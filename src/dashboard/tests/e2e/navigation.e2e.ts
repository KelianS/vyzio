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

    const mainNav = page.getByRole('navigation', { name: 'Navigation principale' })
    const rubrics = page.getByRole('navigation', { name: 'Rubriques de réglages' })

    await page.goto('/')
    await expect(
      page.locator('.hub-status-bar, .hub-setup-hero, .hub-degraded-panel'),
    ).toBeVisible()

    // La barre principale ne porte que la consultation, plus une entree de reglages.
    await mainNav.getByRole('link', { name: 'Historique', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Historique des detections' })).toBeVisible()

    // Chaque rubrique de reglages est atteignable depuis le premier niveau.
    await mainNav.getByRole('link', { name: 'Réglages', exact: true }).click()

    await rubrics.getByRole('link', { name: /Caméras/ }).click()
    // La rubrique s'ouvre sur la **liste** ; ajouter une camera est une tache
    // distincte, avec sa propre page.
    await expect(page.getByRole('heading', { name: 'Caméras' })).toBeVisible()

    await rubrics.getByRole('link', { name: /Détection/ }).click()
    await expect(page.getByRole('heading', { name: 'Gestion des personnes connues' })).toBeVisible()

    await rubrics.getByRole('link', { name: /Conservation/ }).click()
    await expect(page.getByRole('heading', { name: 'Conservation' })).toBeVisible()

    await rubrics.getByRole('link', { name: /Notifications/ }).click()
    await expect(page.getByRole('heading', { name: 'Configuration des alertes' })).toBeVisible()

    await rubrics.getByRole('link', { name: /Système/ }).click()
    await expect(page.getByRole('heading', { name: 'Système' })).toBeVisible()

    // Le niche est mis en profondeur, pas cache : l'interface technique n'est
    // atteignable qu'en depliant « Avance », et elle l'est toujours.
    await expect(page.getByRole('link', { name: /interface technique/ })).toBeHidden()
    await page.getByRole('group').filter({ hasText: 'Avancé' }).getByText('Avancé').click()
    await page.getByRole('link', { name: /interface technique/ }).click()
    await expect(page.locator('.expert-shell, .expert-error-panel')).toBeVisible()

    await mainNav.getByRole('link', { name: 'Accueil', exact: true }).click()
    await expect(page).toHaveURL('/')

    expect(consoleErrors, `Console errors while navigating:\n${consoleErrors.join('\n')}`).toEqual(
      [],
    )
  })

  test('user_When following a link to an old address_Should land on the new one', async ({
    page,
  }) => {
    await installFakeBackend(page, createFakeBackendState({ cameras: [makeFakeCamera()] }))

    // Un favori ou un lien garde ne doit pas tomber dans le vide parce que
    // l'arborescence a change.
    for (const [old, expected] of [
      ['/cameras', '/settings/cameras'],
      ['/profiles', '/settings/detection/personnes'],
      ['/notifications', '/settings/notifications'],
      ['/expert', '/settings/systeme/avance'],
    ]) {
      await page.goto(old)
      await expect(page).toHaveURL(expected)
    }
  })
})
