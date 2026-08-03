import { test, expect } from '@playwright/test'
import { installFakeBackend, createFakeBackendState, makeFakeCamera } from './fixtures/fakeBackend'

test.describe('Cameras — ajout', () => {
  test('user_When finding and adding a camera_Should land on its settings', async ({ page }) => {
    await installFakeBackend(page, createFakeBackendState({ cameras: [] }))

    await page.goto('/settings/cameras/ajout')
    await expect(page.getByRole('heading', { name: 'Ajouter une caméra' })).toBeVisible()

    // Le cout de la recherche est annonce avant de l'engager.
    await page.getByRole('button', { name: 'Rechercher sur le réseau' }).click()
    await expect(page.getByRole('dialog')).toContainText('15 à 30 secondes')
    await page.getByRole('dialog').getByRole('button', { name: 'Rechercher' }).click()

    await expect(page.getByRole('button', { name: /Caméra détectée/ })).toBeVisible()

    await page.getByRole('button', { name: 'Vérifier la connexion' }).click()
    await expect(page.getByText(/Flux valide/)).toBeVisible()

    await page.getByRole('button', { name: 'Ajouter la caméra' }).click()

    // L'ajout conduit la ou l'on regle la camera : c'est la suite de la tache.
    await expect(page).toHaveURL(/\/settings\/cameras\/camera-\d+\/detection$/)
    // Et le redemarrage devient possible, la configuration ayant change (ADR-44).
    await expect(page.getByRole('button', { name: /Appliquer les changements/ })).toBeVisible()
  })

  test('user_When the network yields nothing_Should still be able to type the address', async ({
    page,
  }) => {
    await installFakeBackend(page, createFakeBackendState({ cameras: [] }))
    await page.goto('/settings/cameras/ajout')

    // La saisie manuelle est offerte d'emblee, sans avoir a chercher d'abord.
    await page.getByRole('button', { name: /Saisir l’adresse moi-même/ }).click()
    await expect(page.getByRole('textbox', { name: 'Nom' })).toBeVisible()
    await expect(page.getByRole('textbox', { name: 'Adresse' })).toBeVisible()
  })

  test('user_When a camera is already in the catalogue_Should not be offered again', async ({
    page,
  }) => {
    // Meme hote que la camera trouvee par la recherche.
    await installFakeBackend(
      page,
      createFakeBackendState({ cameras: [makeFakeCamera({ host: '192.168.1.77' })] }),
    )
    await page.goto('/settings/cameras/ajout')

    await page.getByRole('button', { name: 'Rechercher sur le réseau' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Rechercher' }).click()

    // La recherche a bien eu lieu — c'est son resultat qui est ecarte.
    await expect(page.getByText('1 caméra(s) trouvée(s).')).toBeVisible()
    await expect(page.getByRole('button', { name: /Caméra détectée/ })).toHaveCount(0)
  })
})
