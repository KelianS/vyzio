import { test, expect } from '@playwright/test'
import { installFakeBackend, createFakeBackendState, makeFakeCamera } from './fixtures/fakeBackend'

/**
 * Une page est nommee **une seule fois**.
 *
 * Chaque palier avait fini par redire le meme mot : l'onglet « Vie privee », le
 * cadre « Vie privee », puis la section legataire — trois titres identiques pour
 * un unique reglage. Ces tests tiennent la regle, parce qu'elle se reperd a
 * chaque ecran ajoute : poser un cadre titre est le geste spontane.
 */
const CAMERA_TABS = [
  ['detection', 'Détection'],
  ['conservation', 'Conservation'],
  ['vie-privee', 'Vie privée'],
  ['image', 'Image et pilotage'],
  ['connexion', 'Connexion'],
] as const

test.describe('Hiérarchie — une page se nomme une fois', () => {
  test.beforeEach(async ({ page }) => {
    await installFakeBackend(
      page,
      createFakeBackendState({
        cameras: [makeFakeCamera({ ptzSupported: true, verifiedCapabilities: ['image_settings'] })],
      }),
    )
  })

  for (const [slug, label] of CAMERA_TABS) {
    test(`camera_When opening the ${slug} tab_Should not repeat the tab name as a heading`, async ({
      page,
    }) => {
      await page.goto(`/settings/cameras/camera-1/${slug}`)

      // L'onglet actif nomme deja la page, et il reste affiche au-dessus d'elle.
      const tabs = page.getByRole('navigation', { name: 'Réglages de la caméra' })
      await expect(tabs.getByRole('link', { name: label, exact: true })).toHaveAttribute(
        'aria-current',
        'page',
      )
      await expect(page.getByRole('heading', { name: label })).toHaveCount(0)
    })
  }

  test('camera_When opening a camera_Should be named by the camera, not by its rubric', async ({
    page,
  }) => {
    // Sur petit ecran le menu des rubriques s'efface : ne restent que les
    // reperes que la page se donne elle-meme.
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/settings/cameras/camera-1/detection')

    await expect(page.getByRole('heading', { name: 'Porte d’entrée' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Caméras' })).toHaveCount(0)

    // Un seul retour, celui de la fiche — la barre du haut mise a part. Deux
    // fleches empilees ne disent plus laquelle ramene ou.
    await expect(page.getByRole('link', { name: 'Caméras', exact: true })).toHaveCount(1)
    await expect(page.getByRole('link', { name: 'Réglages', exact: true })).toHaveCount(1)
  })

  test('rubric_When opening a rubric page on a phone_Should still be named once', async ({
    page,
  }) => {
    // Le menu des rubriques cede la place a la page : sans ce titre, l'ecran
    // n'aurait plus rien pour se nommer.
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/settings/conservation')

    await expect(page.getByRole('heading', { name: 'Conservation', level: 1 })).toHaveCount(1)
  })
})
