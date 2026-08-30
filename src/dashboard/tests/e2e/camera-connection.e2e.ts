import { test, expect } from '@playwright/test'
import { installFakeBackend, createFakeBackendState, makeFakeCamera } from './fixtures/fakeBackend'

/**
 * Editing and deleting a camera had become unreachable when the camera page was
 * taken out of the old screen: the use case still existed, no interface called it
 * any more. This journey keeps the door open.
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

    // The name travels up to the page title, and so up to the shared catalogue.
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
