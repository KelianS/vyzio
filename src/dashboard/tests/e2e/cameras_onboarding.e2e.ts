import { test, expect } from '@playwright/test'
import {
  installFakeBackend,
  createFakeBackendState,
  makeFakeCamera,
  makeFakeProtocol,
} from './fixtures/fake_backend'

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
  test('AddCameraView_ShouldLandOnConnexionAndFindTheStream_WhenTheUserFindsAndAddsACamera', async ({
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
    await expect(page.getByRole('textbox', { name: 'Nom' })).toHaveCount(0)
    await page.getByRole('button', { name: /Caméra détectée/ }).click()

    // Only the access is asked: nothing to verify before the camera exists (ADR-68 a).
    await expect(page.getByRole('textbox', { name: 'Nom' })).toHaveValue('Caméra détectée')
    await expect(page.getByRole('textbox', { name: 'Chemin du flux' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Vérifier la connexion' })).toHaveCount(0)
    await page.getByRole('textbox', { name: 'Identifiant' }).fill('viewer')
    await page.getByLabel('Mot de passe').fill('not-a-real-secret')
    await page.getByRole('button', { name: 'Ajouter la caméra' }).click()

    // Adding opens the camera's page, which detects it on arrival (ADR-68 b).
    await expect(page).toHaveURL(/\/settings\/cameras\/camera-\d+\/connexion$/)
    // The page says what detection found, in plain words, and keeps it on screen.
    await expect(
      page.getByText('Détection terminée : le flux vidéo de la caméra fonctionne.'),
    ).toBeVisible()
    const stream = page
      .getByRole('list', { name: 'Capacités' })
      .getByRole('listitem')
      .filter({ hasText: 'Flux vidéo' })
    await expect(stream.getByText('Fonctionne')).toBeVisible()
    // Its stream works, surveillance has not taken it in yet: the restart does (ADR-68 d).
    await expect(page.getByText('Pas encore surveillée')).toBeVisible()
    await expect(page.getByRole('button', { name: /Appliquer les changements/ })).toBeVisible()
  })

  test('AddCameraView_ShouldStayToSetUpAndLeadToItsPageFromTheHub_WhenItsStreamIsNotFound', async ({
    page,
  }) => {
    // Nothing answers at the camera's address: detection finds no stream.
    await installFakeBackend(
      page,
      createFakeBackendState({
        cameras: [],
        protocols: [makeFakeProtocol({ status: 'unreachable' })],
      }),
    )
    await page.goto('/settings/cameras/ajout')

    await page.getByRole('button', { name: 'Saisir l’adresse moi-même' }).click()
    await page.getByRole('textbox', { name: 'Nom' }).fill('Garage')
    await page.getByRole('textbox', { name: 'Adresse' }).fill('192.168.1.90')
    await page.getByRole('button', { name: 'Ajouter la caméra' }).click()

    // Nothing answers at that address: the page says so, never that detection simply finished.
    await expect(page.getByText(/^Rien ne répond à cette adresse/)).toBeVisible()
    // The page header first, then the stream card, each saying it with its own meaning.
    await expect(page.getByText('À configurer').first()).toBeVisible()
    // No restart: the camera stays out of surveillance until its stream works.
    await expect(page.getByRole('button', { name: /Appliquer les changements/ })).toHaveCount(0)

    await page.goto('/')
    await page.getByRole('link', { name: 'À configurer : Garage' }).click()
    await expect(page).toHaveURL(/\/settings\/cameras\/camera-\d+\/connexion$/)
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

    await expect(page.getByRole('textbox', { name: 'Nom' })).toHaveValue('Caméra ICSee')
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
    await expect(page.getByRole('spinbutton', { name: 'Port' })).toHaveCount(0)
  })

  test('AddCameraView_ShouldShowTheChosenVendorsHelp_WhenTheUserTypesTheAddress', async ({
    page,
  }) => {
    await installFakeBackend(page, createFakeBackendState({ cameras: [] }))
    await page.goto('/settings/cameras/ajout')

    await page.getByRole('button', { name: 'Saisir l’adresse moi-même' }).click()
    await page.getByRole('combobox', { name: 'Marque' }).click()
    await page.getByRole('option', { name: 'V380 PRO' }).click()

    await expect(page.getByText('Créez le compte caméra dans l’application')).toBeVisible()
  })

  test('AddCameraView_ShouldFoldTheListAndLetItReopen_WhenTheUserChoosesACamera', async ({
    page,
  }) => {
    await installFakeBackend(page, createFakeBackendState({ cameras: [] }))
    await page.goto('/settings/cameras/ajout')

    await page.getByRole('button', { name: 'Rechercher sur le réseau' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Rechercher' }).click()

    // Readiness reads without opening; an unrecognised vendor shows nothing (#274).
    const candidate = page.getByRole('button', { name: /Caméra détectée/ })
    await expect(candidate).toContainText('Prête')
    await expect(candidate).not.toContainText('Marque')

    await candidate.click()

    // Folded, the list makes room for the access - on a phone it used to push it out of sight.
    await expect(candidate).toHaveCount(0)
    await expect(page.getByRole('textbox', { name: 'Nom' })).toBeVisible()

    await page.getByRole('button', { name: 'Changer' }).click()
    await expect(candidate).toBeVisible()
    await expect(page.getByRole('textbox', { name: 'Nom' })).toHaveCount(0)
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
