import { test, expect } from '@playwright/test'
import { installFakeBackend, createFakeBackendState } from './fixtures/fakeBackend'

test.describe('Cameras — onboarding', () => {
  test('user_When discovering and adding a camera_Should appear selected in the sidebar', async ({
    page,
  }) => {
    await installFakeBackend(page, createFakeBackendState({ cameras: [] }))

    await page.goto('/cameras')
    await expect(page.getByRole('heading', { name: 'Decouverte guidee' })).toBeVisible()
    await expect(page.getByText('Aucune camera visible')).toBeVisible()

    await page.getByRole('button', { name: 'Scanner' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.getByRole('button', { name: 'Lancer le scan' }).click()

    await expect(page.getByRole('heading', { name: 'Caméra détectée' })).toBeVisible()

    await page.getByRole('button', { name: 'Verifier la connexion', exact: true }).click()
    await expect(page.getByText(/Flux valide/)).toBeVisible()

    await page.getByRole('button', { name: 'Ajouter', exact: true }).click()

    await expect(page.locator('.camera-sidebar-count').first()).toHaveText('1')
    await expect(page.locator('.camera-nav-item.selected')).toBeVisible()
  })
})
