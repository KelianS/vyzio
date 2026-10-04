import { test, expect } from '@playwright/test'
import { installFakeBackend, createFakeBackendState, makeFakeCamera } from './fixtures/fake_backend'

const dvripOnlyCandidate = {
  displayName: 'Caméra ICSee',
  host: '192.168.1.78',
  port: 34567,
  sourceType: 'rtsp_manual',
  streamPath: null,
  rtspActive: false,
  discoverySource: 'port_scan',
  note: null,
  macAddress: null,
  isSupported: false,
  qualification: 'camera_confirmed',
  supportLevel: 'unknown',
  vendorFamily: null,
  qualificationReasons: ['camera_port_open', 'dvrip_port_detected'],
  vendorDocumentation: null,
  technicalDetails: null,
  stream: { protocol: 'dvrip', port: 34567, path: null },
}

test.describe('AddCameraView', () => {
  test('AddCameraView_ShouldLandOnTheCameraSettings_WhenTheUserFindsAndAddsACamera', async ({
    page,
  }) => {
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
    await expect(page).toHaveURL(/\/settings\/cameras\/camera-\d+\/connexion$/)
    // And restarting becomes possible, the configuration having changed (ADR-44).
    await expect(page.getByRole('button', { name: /Appliquer les changements/ })).toBeVisible()
  })

  test('AddCameraView_ShouldAddACameraOverDvripDirectly_WhenItsStreamIsReadyOverDvripOnly', async ({
    page,
  }) => {
    await installFakeBackend(page, createFakeBackendState({ cameras: [] }))
    // A camera that answers DVRIP and has no RTSP stream.
    await page.route('**/api/cameras/discovery', (route) =>
      route.fulfill({ json: [dvripOnlyCandidate] }),
    )
    await page.goto('/settings/cameras/ajout')

    await page.getByRole('button', { name: 'Rechercher sur le réseau' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Rechercher' }).click()

    const candidate = page.getByRole('button', { name: /Caméra ICSee/ })
    await expect(candidate).toContainText('Prête')
    await candidate.click()

    // Its stream needs no path: the form opens on it, ready to add.
    await expect(page.getByRole('textbox', { name: 'Nom' })).toHaveValue('Caméra ICSee')
    await expect(page.getByRole('textbox', { name: 'Chemin du flux' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Ajouter la caméra' }).click()

    await expect(page).toHaveURL(/\/settings\/cameras\/camera-\d+\/connexion$/)
  })

  test('AddCameraView_ShouldOfferManualEntry_WhenNoSearchHasRun', async ({ page }) => {
    await installFakeBackend(page, createFakeBackendState({ cameras: [] }))
    await page.goto('/settings/cameras/ajout')

    // Manual entry is offered right away, without having to search first.
    await page.getByRole('button', { name: 'Saisir l’adresse moi-même' }).click()
    await expect(page.getByRole('textbox', { name: 'Nom' })).toBeVisible()
    await expect(page.getByRole('textbox', { name: 'Adresse' })).toBeVisible()
  })

  test('AddCameraView_ShouldFoldTheListAndLetItReopen_WhenTheUserChoosesACamera', async ({
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

  test('AddCameraView_ShouldNotOfferTheCameraAgain_WhenItIsAlreadyInTheCatalogue', async ({
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
