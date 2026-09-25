import { test, expect } from '@playwright/test'
import { installFakeBackend, createFakeBackendState, makeFakeCamera } from './fixtures/fakeBackend'

// A refused password is its own cause, with where to fix it (SPECS 2.2, ADR-58).
test.describe('Refused camera account', () => {
  test('CameraListPage_ShouldNameTheRefusedPassword_WhenTheCameraRefusedItsAccount', async ({
    page,
  }) => {
    const state = createFakeBackendState({
      cameras: [makeFakeCamera({ status: 'offline', accountRefusedAt: '2026-09-25T10:00:00Z' })],
    })
    await installFakeBackend(page, state)
    await page.goto('/settings/cameras')

    await expect(page.getByText('Mot de passe refusé')).toBeVisible()
    await expect(page.getByText('Hors ligne')).toHaveCount(0)
  })

  test('CameraConnectionPage_ShouldSayWhereToFixIt_WhenTheCameraRefusedItsAccount', async ({
    page,
  }) => {
    const state = createFakeBackendState({
      cameras: [makeFakeCamera({ accountRefusedAt: '2026-09-25T10:00:00Z' })],
    })
    await installFakeBackend(page, state)
    await page.goto('/settings/cameras/camera-1/connexion')

    await expect(page.getByRole('status')).toContainText('La caméra refuse son mot de passe')
  })
})
