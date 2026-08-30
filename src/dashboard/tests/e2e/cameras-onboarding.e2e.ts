import { test, expect } from '@playwright/test'
import { installFakeBackend, createFakeBackendState, makeFakeCamera } from './fixtures/fakeBackend'

test.describe('Cameras — ajout', () => {
  test('user_When finding and adding a camera_Should land on its settings', async ({ page }) => {
    await installFakeBackend(page, createFakeBackendState({ cameras: [] }))

    await page.goto('/settings/cameras/ajout')
    await expect(page.getByRole('heading', { name: 'Ajouter une caméra' })).toBeVisible()

    // The cost of the search is announced before starting it.
    await page.getByRole('button', { name: 'Rechercher sur le réseau' }).click()
    await expect(page.getByRole('alertdialog')).toContainText('15 à 30 secondes')
    await page.getByRole('alertdialog').getByRole('button', { name: 'Rechercher' }).click()

    // The form does not exist before a camera is picked.
    await expect(page.getByRole('textbox', { name: 'Chemin du flux' })).toHaveCount(0)
    await page.getByRole('button', { name: /Caméra détectée/ }).click()

    await page.getByRole('button', { name: 'Vérifier la connexion' }).click()
    await expect(page.getByText(/Flux valide/)).toBeVisible()

    await page.getByRole('button', { name: 'Ajouter la caméra' }).click()

    // Adding leads where the camera is set: that is the rest of the task.
    await expect(page).toHaveURL(/\/settings\/cameras\/camera-\d+\/detection$/)
    // And restarting becomes possible, the configuration having changed (ADR-44).
    await expect(page.getByRole('button', { name: /Appliquer les changements/ })).toBeVisible()
  })

  test('user_When the network yields nothing_Should still be able to type the address', async ({
    page,
  }) => {
    await installFakeBackend(page, createFakeBackendState({ cameras: [] }))
    await page.goto('/settings/cameras/ajout')

    // Manual entry is offered right away, without having to search first.
    await page.getByRole('button', { name: 'Saisir l’adresse moi-même' }).click()
    await expect(page.getByRole('textbox', { name: 'Nom' })).toBeVisible()
    await expect(page.getByRole('textbox', { name: 'Adresse' })).toBeVisible()
  })

  test('user_When choosing a camera_Should see the list fold away, and be able to reopen it', async ({
    page,
  }) => {
    await installFakeBackend(page, createFakeBackendState({ cameras: [] }))
    await page.goto('/settings/cameras/ajout')

    await page.getByRole('button', { name: 'Rechercher sur le réseau' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Rechercher' }).click()

    // Confidence reads without opening: known brand, and camera reachable.
    const candidate = page.getByRole('button', { name: /Caméra détectée/ })
    await expect(candidate).toContainText('Marque inconnue')
    await expect(candidate).toContainText('Prête')

    await candidate.click()

    // Folded, the list makes room for the configuration - on a phone it used to
    // push it out of sight.
    await expect(candidate).toHaveCount(0)
    await expect(page.getByRole('textbox', { name: 'Chemin du flux' })).toBeVisible()

    await page.getByRole('button', { name: 'Changer' }).click()
    await expect(candidate).toBeVisible()
    await expect(page.getByRole('textbox', { name: 'Chemin du flux' })).toHaveCount(0)
  })

  test('user_When a camera is already in the catalogue_Should not be offered again', async ({
    page,
  }) => {
    // Same host as the camera found by the search.
    await installFakeBackend(
      page,
      createFakeBackendState({ cameras: [makeFakeCamera({ host: '192.168.1.77' })] }),
    )
    await page.goto('/settings/cameras/ajout')

    await page.getByRole('button', { name: 'Rechercher sur le réseau' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Rechercher' }).click()

    // The search did happen - it is its result that is set aside.
    await expect(page.getByText('1 caméra(s) trouvée(s).')).toBeVisible()
    await expect(page.getByRole('button', { name: /Caméra détectée/ })).toHaveCount(0)
  })
})
