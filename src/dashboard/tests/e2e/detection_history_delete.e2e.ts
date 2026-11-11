import { test, expect } from '@playwright/test'
import {
  installFakeBackend,
  createFakeBackendState,
  makeFakeDetectionEvent,
} from './fixtures/fake_backend'

test.describe('DetectionHistoryView deletion', () => {
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
  })

  test('DetectionHistoryView_ShouldRemoveTheDetectionEverywhere_WhenTheUserConfirmsItsDeletion', async ({
    page,
  }) => {
    await page.goto('/history')
    await page
      .getByRole('button', { name: /Supprimer la détection : Détection « Voiture »/ })
      .click()

    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toContainText('tout ce que la caméra a enregistré pendant ce passage')
    await expect(dialog).toContainText('Les notifications déjà reçues restent')
    await dialog.getByRole('button', { name: 'Supprimer' }).click()

    await expect(page.getByText('Détection supprimée.')).toBeVisible()
    await expect(page.getByText(/garage/)).toHaveCount(0)
    await expect(page.getByText(/front door/)).toBeVisible()

    await page.getByRole('link', { name: 'Accueil' }).click()
    await expect(page.getByText(/front door/).first()).toBeVisible()
    await expect(page.getByText(/garage/)).toHaveCount(0)
  })

  test('DetectionHistoryView_ShouldKeepTheDetection_WhenTheUserCancelsItsDeletion', async ({
    page,
  }) => {
    await page.goto('/history')
    await page
      .getByRole('button', { name: /Supprimer la détection : Détection « Voiture »/ })
      .click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Annuler' }).click()

    await expect(page.getByRole('alertdialog')).toHaveCount(0)
    await expect(page.getByText(/garage/)).toBeVisible()
  })
})
