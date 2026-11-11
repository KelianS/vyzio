import { test, expect, type Page } from '@playwright/test'
import {
  installFakeBackend,
  createFakeBackendState,
  makeFakeDetectionEvent,
} from './fixtures/fake_backend'

async function openTheCarPreview(page: Page) {
  await page.goto('/history')
  await page.getByRole('button', { name: /Voir l’aperçu.*Voiture/ }).click()
  return page.getByRole('dialog', { name: 'Aperçu de la détection' })
}

test.describe('DetectionHistoryView deletion', () => {
  test.beforeEach(async ({ page }) => {
    await installFakeBackend(
      page,
      createFakeBackendState({
        detectionHistory: [
          makeFakeDetectionEvent({ hasClip: true }),
          makeFakeDetectionEvent({
            eventId: 'evt-2',
            camera: 'garage',
            cameraName: 'garage',
            label: 'car',
            confidence: 0.81,
          }),
        ],
        clipsGone: ['event-1'],
      }),
    )
  })

  test('DetectionHistoryView_ShouldRemoveTheDetectionEverywhere_WhenTheUserConfirmsItsDeletion', async ({
    page,
  }) => {
    const preview = await openTheCarPreview(page)
    await preview.getByRole('button', { name: 'Supprimer' }).click()

    const question = page.getByRole('alertdialog')
    await expect(question).toContainText('La détection et sa vidéo seront effacées.')
    await question.getByRole('button', { name: 'Supprimer' }).click()

    await expect(page.getByText('Détection supprimée.')).toBeVisible()
    await expect(preview).toHaveCount(0)
    await expect(page.getByText(/garage/)).toHaveCount(0)
    await expect(page.getByText(/front door/)).toBeVisible()

    await page.getByRole('link', { name: 'Accueil' }).click()
    await expect(page.getByText(/front door/).first()).toBeVisible()
    await expect(page.getByText(/garage/)).toHaveCount(0)
  })

  test('DetectionHistoryView_ShouldKeepTheDetection_WhenTheUserCancelsItsDeletion', async ({
    page,
  }) => {
    const preview = await openTheCarPreview(page)
    await preview.getByRole('button', { name: 'Supprimer' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Annuler' }).click()

    await expect(page.getByRole('alertdialog')).toHaveCount(0)
    await expect(page.getByText(/garage/)).toBeVisible()
  })

  test('DetectionHistoryView_ShouldSayTheVideoWasDeleted_WhenItWasErasedWithAnotherDetection', async ({
    page,
  }) => {
    await page.goto('/history')
    await page.getByRole('button', { name: 'Vidéo' }).click()

    await expect(page.getByText('La vidéo de ce moment a été supprimée.')).toBeVisible()
  })
})
