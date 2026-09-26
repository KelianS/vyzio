import { test, expect } from '@playwright/test'
import {
  installFakeBackend,
  createFakeBackendState,
  makeFakeDetectionEvent,
} from './fixtures/fake_backend'

test.describe('DetectionHistoryView filters', () => {
  test.beforeEach(async ({ page }) => {
    await installFakeBackend(
      page,
      createFakeBackendState({
        detectionHistory: [
          makeFakeDetectionEvent({}),
          makeFakeDetectionEvent({
            eventId: 'evt-2',
            camera: 'garage',
            cameraName: 'garage',
            label: 'car',
            confidence: 0.81,
          }),
        ],
      }),
    )
    await page.goto('/history')
    // Filters are an option you open (see `ui_defauts.e2e.ts`), not the top of the screen.
    await page.getByRole('button', { name: 'Filtrer' }).click()
  })

  test('DetectionHistoryView_ShouldNarrowTheList_WhenTheUserFiltersByType', async ({ page }) => {
    await expect(page.getByText(/front door/)).toBeVisible()
    await expect(page.getByText(/garage/)).toBeVisible()

    await page.getByRole('combobox').filter({ hasText: 'Tous' }).click()
    await page.getByRole('option', { name: /Voiture/ }).click()

    await expect(page.getByText(/garage/)).toBeVisible()
    await expect(page.getByText(/front door/)).toHaveCount(0)
  })

  test('DetectionHistoryView_ShouldBlameTheFilters_WhenTheyMatchNothing', async ({ page }) => {
    await page.getByLabel('Caméra').fill('cave')

    await expect(page.getByText('Aucune détection avec ces filtres.')).toBeVisible()
  })

  test('DetectionHistoryView_ShouldOfferAWayBackToEverything_WhenAFilterIsActive', async ({
    page,
  }) => {
    // Nothing to reset as long as nothing is filtered.
    await expect(page.getByRole('button', { name: 'Tout afficher' })).toHaveCount(0)

    await page.getByRole('combobox').filter({ hasText: 'Tous' }).click()
    await page.getByRole('option', { name: /Voiture/ }).click()

    await page.getByRole('button', { name: 'Tout afficher' }).click()
    await expect(page.getByText(/front door/)).toBeVisible()
    await expect(page.getByText(/garage/)).toBeVisible()
  })
})
