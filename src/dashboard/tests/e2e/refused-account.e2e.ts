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
    await expect(notice).toContainText('RTSP DESCRIBE 401')
  })
})
