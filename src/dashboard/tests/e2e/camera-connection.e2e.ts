import { test, expect } from '@playwright/test'
import { installFakeBackend, createFakeBackendState, makeFakeCamera } from './fixtures/fakeBackend'

/**
 * Editer et supprimer une camera etaient devenus injoignables en sortant la
 * fiche camera de l'ancien ecran : le cas d'usage existait encore, plus aucune
 * interface ne l'appelait. Ce parcours garde la porte ouverte.
 */
test.describe('Caméra — connexion', () => {
  test.beforeEach(async ({ page }) => {
    await installFakeBackend(page, createFakeBackendState({ cameras: [makeFakeCamera()] }))
    await page.goto('/settings/cameras/camera-1/connexion')
  })

  test('user_When renaming a camera_Should save it through the draft cycle', async ({ page }) => {
    const name = page.getByRole('textbox', { name: 'Nom' })
    await expect(name).toHaveValue('Porte d’entrée')

    await name.fill('Portail')

    const bar = page.getByRole('region', { name: 'Modifications en attente' })
    await expect(bar).toContainText('Nom')

    await page.getByRole('button', { name: 'Enregistrer' }).click()
    await expect(bar).toBeHidden()

    // Le nom voyage jusqu'au titre de la fiche, donc jusqu'au catalogue partage.
    await expect(page.getByRole('heading', { name: 'Portail' })).toBeVisible()
  })

  test('user_When deleting a camera_Should confirm first, then land back on the list', async ({
    page,
  }) => {
    await page.getByRole('button', { name: 'Supprimer cette caméra' }).click()
    await expect(page.getByText('Supprimer « Porte d’entrée » ?')).toBeVisible()

    await page.getByRole('button', { name: 'Supprimer', exact: true }).click()
    await expect(page).toHaveURL('/settings/cameras')
  })
})
