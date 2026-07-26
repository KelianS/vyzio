import { test, expect } from '@playwright/test'
import { installFakeBackend, createFakeBackendState } from './fixtures/fakeBackend'

test.describe('Profiles — create', () => {
  test('user_When creating a new profile_Should appear in the sidebar and be selected', async ({
    page,
  }) => {
    await installFakeBackend(page, createFakeBackendState({ profiles: [] }))

    await page.goto('/profiles')
    await expect(page.getByRole('heading', { name: 'Gestion des personnes connues' })).toBeVisible()
    await expect(page.getByText('Aucun profil')).toBeVisible()

    await page.getByRole('button', { name: '+ Nouveau profil' }).click()
    await page.getByLabel('Nom').fill('Alice Martin')
    await page.getByRole('button', { name: 'Enregistrer' }).click()

    await expect(page.getByRole('heading', { name: 'Informations' })).toBeVisible()
    await expect(page.locator('.camera-sidebar-count')).toHaveText('1')
    await expect(page.locator('.camera-nav-item.selected')).toContainText('Alice Martin')
  })
})
