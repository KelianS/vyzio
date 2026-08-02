import { test, expect } from '@playwright/test'
import { installFakeBackend, createFakeBackendState } from './fixtures/fakeBackend'

test.describe('Cameras — onboarding', () => {
  test('user_When discovering and adding a camera_Should land on its settings', async ({
    page,
  }) => {
    await installFakeBackend(page, createFakeBackendState({ cameras: [] }))

    await page.goto('/settings/cameras/ajout')
    await expect(page.getByRole('heading', { name: 'Decouverte guidee' })).toBeVisible()

    await page.getByRole('button', { name: 'Scanner' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.getByRole('button', { name: 'Lancer le scan' }).click()

    await expect(page.getByRole('heading', { name: 'Caméra détectée' })).toBeVisible()

    await page.getByRole('button', { name: 'Verifier la connexion', exact: true }).click()
    await expect(page.getByText(/Flux valide/)).toBeVisible()

    await page.getByRole('button', { name: 'Ajouter', exact: true }).click()

    // La camera ajoutee rejoint la liste, qui est desormais le premier niveau
    // de la rubrique — la decouverte n'occupe plus l'ecran une fois finie.
    await page.goto('/settings/cameras')
    await expect(page.getByRole('link', { name: /Camera detectee|Caméra détectée/ })).toBeVisible()
  })
})
