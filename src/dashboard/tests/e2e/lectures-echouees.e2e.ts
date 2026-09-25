import { test, expect, type Page } from '@playwright/test'
import { installFakeBackend, createFakeBackendState, makeFakeCamera } from './fixtures/fakeBackend'

const SERVER_FAILURE = 'Vyzio a rencontré une erreur, réessayez dans un instant'

// Registered after the fake backend, so it answers first for this one read.
async function failRead(page: Page, path: string) {
  await page.route(`**${path}`, (route) =>
    route.request().method() === 'GET'
      ? route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ status: 500, traceId: '00-e2e-read' }),
        })
      : route.fallback(),
  )
}

// A read that fails says so with its diagnostic line, never an empty or stale page (SPECS 1.5).
test.describe('Lectures échouées', () => {
  test('ConservationPage_ShouldShowTheFailure_WhenTheSettingsCannotBeRead', async ({ page }) => {
    await installFakeBackend(page, createFakeBackendState({ cameras: [makeFakeCamera()] }))
    await failRead(page, '/api/settings/recording')
    await page.goto('/settings/conservation')

    const alert = page.getByRole('alert')
    await expect(alert).toContainText(SERVER_FAILURE)
    await expect(alert).toContainText('500')
  })

  test('CameraConservationPage_ShouldShowTheFailure_WhenTheCameraSettingsCannotBeRead', async ({
    page,
  }) => {
    await installFakeBackend(page, createFakeBackendState({ cameras: [makeFakeCamera()] }))
    await failRead(page, '/api/cameras/camera-1/detection-config')
    await page.goto('/settings/cameras/camera-1/conservation')

    const alert = page.getByRole('alert')
    await expect(alert).toContainText(SERVER_FAILURE)
    await expect(alert).toContainText('500')
  })

  test('HubView_ShouldShowTheFailureInsteadOfOnboarding_WhenTheCamerasCannotBeRead', async ({
    page,
  }) => {
    await installFakeBackend(page, createFakeBackendState({ cameras: [makeFakeCamera()] }))
    await failRead(page, '/api/cameras')
    await page.goto('/')

    await expect(page.getByRole('alert')).toContainText(SERVER_FAILURE)
    await expect(page.getByText('Ajouter une caméra')).toHaveCount(0)
  })

  test('CameraListPage_ShouldShowTheFailure_WhenTheCamerasCannotBeRead', async ({ page }) => {
    await installFakeBackend(page, createFakeBackendState({ cameras: [makeFakeCamera()] }))
    await failRead(page, '/api/cameras')
    await page.goto('/settings/cameras')

    await expect(page.getByRole('alert')).toContainText(SERVER_FAILURE)
    await expect(page.getByText('Aucune caméra pour l’instant.')).toHaveCount(0)
  })
})
