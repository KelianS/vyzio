import { test, expect } from '@playwright/test'
import { installFakeBackend, createFakeBackendState, makeFakeCamera } from './fixtures/fakeBackend'

const refused = () =>
  createFakeBackendState({
    cameras: [makeFakeCamera({ accountRefusedAt: '2026-09-25T10:00:00Z' })],
  })

// A refused password is its own cause, with where to fix it (SPECS 2.2, ADR-58).
test.describe('Refused camera account', () => {
  test('HubView_ShouldNameTheRefusedPasswordOnTheCamera_WhenTheCameraRefusedItsAccount', async ({
    page,
  }) => {
    await installFakeBackend(page, refused())
    await page.goto('/')

    await expect(page.getByText('Mot de passe refusé')).toBeVisible()
    await expect(page.getByText('Reconnexion…')).toHaveCount(0)

    await page.getByRole('link', { name: 'Corriger le mot de passe' }).click()
    await expect(page).toHaveURL(/\/settings\/cameras\/camera-1\/connexion$/)
  })

  test('CameraConnectionPage_ShouldNotSayReachable_WhenTheCameraStillRefusesItsAccount', async ({
    page,
  }) => {
    await installFakeBackend(page, refused())
    await page.goto('/settings/cameras/camera-1/connexion')

    await page.getByRole('button', { name: 'Vérifier la connexion' }).click()

    await expect(page.getByText('La caméra refuse toujours son mot de passe.')).toBeVisible()
    await expect(page.getByText('Caméra joignable.')).toHaveCount(0)
  })

  test('CameraImagePage_ShouldSuspendPilotage_WhenTheCameraRefusedItsAccount', async ({ page }) => {
    const state = createFakeBackendState({
      cameras: [makeFakeCamera({ ptzSupported: true, accountRefusedAt: '2026-09-25T10:00:00Z' })],
    })
    await installFakeBackend(page, state)
    await page.goto('/settings/cameras/camera-1/image')

    await expect(
      page.getByText('Pilotage suspendu : la caméra refuse son mot de passe.'),
    ).toBeVisible()
  })

  test('CameraListPage_ShouldNameTheRefusedPassword_WhenTheCameraRefusedItsAccount', async ({
    page,
  }) => {
    await installFakeBackend(page, refused())
    await page.goto('/settings/cameras')

    await expect(page.getByText('Mot de passe refusé')).toBeVisible()
    await expect(page.getByText('Connectee')).toHaveCount(0)
  })

  test('CameraShell_ShouldLeadToWhereThePasswordIsFixed_WhenTheCameraRefusedItsAccount', async ({
    page,
  }) => {
    await installFakeBackend(page, refused())
    await page.goto('/settings/cameras/camera-1/detection')

    await page.getByRole('link', { name: 'Mot de passe refusé' }).click()

    await expect(page).toHaveURL(/\/settings\/cameras\/camera-1\/connexion$/)
    const notice = page.getByRole('status')
    await expect(notice).toContainText('Cette caméra n’enregistre plus')
    await expect(notice).toContainText('RTSP DESCRIBE: account refused')
  })
})
