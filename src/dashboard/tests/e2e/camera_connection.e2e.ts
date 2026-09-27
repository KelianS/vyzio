import { test, expect } from '@playwright/test'
import { installFakeBackend, createFakeBackendState, makeFakeCamera } from './fixtures/fake_backend'

/**
 * Editing and deleting a camera had become unreachable when the camera page was
 * taken out of the old screen: the use case still existed, no interface called it
 * any more. This journey keeps the door open.
 */
test.describe('CameraConnectionView', () => {
  test.beforeEach(async ({ page }) => {
    await installFakeBackend(page, createFakeBackendState({ cameras: [makeFakeCamera()] }))
    await page.goto('/settings/cameras/camera-1/connexion')
  })

  test('CameraConnectionView_ShouldSaveTheNameThroughTheDraft_WhenTheUserRenamesTheCamera', async ({
    page,
  }) => {
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

  test('CameraConnectionView_ShouldSaveTheStreamAddressThroughTheDraft_WhenTheUserFixesItInAdvanced', async ({
    page,
  }) => {
    await page.locator('summary', { hasText: 'Avancé' }).click()
    await page.getByRole('textbox', { name: 'Adresse' }).fill('192.168.1.51')

    const bar = page.getByRole('region', { name: 'Modifications en attente' })
    await expect(bar).toContainText('Adresse')

    await bar.getByRole('button', { name: 'Enregistrer' }).click()
    await expect(bar).toBeHidden()
    await expect(page.getByRole('textbox', { name: 'Adresse' })).toHaveValue('192.168.1.51')
  })

  test('CameraConnectionView_ShouldConfirmThenLandOnTheList_WhenTheUserDeletesTheCamera', async ({
    page,
  }) => {
    await page.getByRole('button', { name: 'Supprimer cette caméra' }).click()
    await expect(page.getByText('Supprimer « Porte d’entrée » ?')).toBeVisible()

    await page.getByRole('button', { name: 'Supprimer', exact: true }).click()
    await expect(page).toHaveURL('/settings/cameras')
  })
})

// The stream is checked like any other capability, from its own card (DESIGN SYSTEM § Capability cards).
test.describe('CameraConnectionView capability cards', () => {
  test('CameraConnectionView_ShouldConfirmEachCapabilityWorks_WhenTheUserChecksThem', async ({
    page,
  }) => {
    const state = createFakeBackendState({ cameras: [makeFakeCamera({ ptzSupported: true })] })
    state.ptzBinding = { protocol: 'onvif', configJson: null }
    await installFakeBackend(page, state)
    await page.goto('/settings/cameras/camera-1/connexion')
    const cards = page.getByRole('list', { name: 'Capacités' }).getByRole('listitem')

    await cards.filter({ hasText: 'Flux vidéo' }).getByRole('button', { name: 'Vérifier' }).click()
    await expect(page.getByText('Flux vidéo : connexion réussie.')).toBeVisible()

    await cards.filter({ hasText: 'Orientation' }).getByRole('button', { name: 'Vérifier' }).click()
    await expect(page.getByText('Orientation : connexion réussie.')).toBeVisible()
  })
})
