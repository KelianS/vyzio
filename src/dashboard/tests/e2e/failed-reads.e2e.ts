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
test.describe('Failed reads', () => {
  test('ConservationPage_ShouldShowTheFailure_WhenTheSettingsCannotBeRead', async ({ page }) => {
    await installFakeBackend(page, createFakeBackendState({ cameras: [makeFakeCamera()] }))
    await failRead(page, '/api/settings/recording')
    await page.goto('/settings/conservation')

    const alert = page.getByRole('alert')
    await expect(alert).toContainText(SERVER_FAILURE)
    await expect(alert).toContainText('500')
  })

  test('ConservationPage_ShouldShowTheSettings_WhenRetriedOnceTheServerAnswers', async ({
    page,
  }) => {
    await installFakeBackend(page, createFakeBackendState({ cameras: [makeFakeCamera()] }))
    await failRead(page, '/api/settings/recording')
    await page.goto('/settings/conservation')
    await expect(page.getByRole('alert')).toBeVisible()

    await page.unroute('**/api/settings/recording')
    await page.getByRole('button', { name: 'Réessayer' }).click()

    await expect(page.getByRole('spinbutton').first()).toBeVisible()
    await expect(page.getByRole('alert')).toHaveCount(0)
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

    const alert = page.getByRole('alert')
    await expect(alert).toContainText(SERVER_FAILURE)
    await expect(alert).toContainText('500')
    // Vyzio did answer: no network checklist, no invitation to add cameras that exist.
    await expect(page.getByText('Vyzio ne répond pas')).toHaveCount(0)
    await expect(page.getByText('Ajouter une caméra')).toHaveCount(0)
  })

  test('CameraListPage_ShouldShowTheFailureAndWithholdAdding_WhenTheCamerasCannotBeRead', async ({
    page,
  }) => {
    await installFakeBackend(page, createFakeBackendState({ cameras: [makeFakeCamera()] }))
    await failRead(page, '/api/cameras')
    await page.goto('/settings/cameras')

    const alert = page.getByRole('alert')
    await expect(alert).toContainText(SERVER_FAILURE)
    await expect(alert).toContainText('500')
    await expect(page.getByText('Aucune caméra pour l’instant.')).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Ajouter une caméra' })).toHaveCount(0)
  })

  test('CameraShell_ShouldShowTheFailureRatherThanNotFound_WhenTheCamerasCannotBeRead', async ({
    page,
  }) => {
    await installFakeBackend(page, createFakeBackendState({ cameras: [makeFakeCamera()] }))
    await failRead(page, '/api/cameras')
    await page.goto('/settings/cameras/camera-1/conservation')

    const alert = page.getByRole('alert')
    await expect(alert).toContainText(SERVER_FAILURE)
    await expect(alert).toContainText('500')
    await expect(page.getByText('Caméra introuvable')).toHaveCount(0)
  })

  test('ReadFailure_ShouldShowTheList_WhenRetriedOnceTheServerAnswers', async ({ page }) => {
    await installFakeBackend(
      page,
      createFakeBackendState({ cameras: [makeFakeCamera({ displayName: 'Entrée' })] }),
    )
    await failRead(page, '/api/cameras')
    await page.goto('/settings/cameras')
    await expect(page.getByRole('alert')).toBeVisible()

    await page.unroute('**/api/cameras')
    await page.getByRole('button', { name: 'Réessayer' }).click()

    await expect(page.getByText('Entrée')).toBeVisible()
    await expect(page.getByRole('alert')).toHaveCount(0)
  })
})
