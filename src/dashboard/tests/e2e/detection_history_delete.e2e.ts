import { test, expect, type Page } from '@playwright/test'
import {
  installFakeBackend,
  createFakeBackendState,
  makeFakeDetectionEvent,
} from './fixtures/fake_backend'

test.use({ viewport: { width: 390, height: 844 } })

/** Puts the car in the player, then opens its « ⋯ » (HIST-18). */
async function openTheCarActions(page: Page) {
  await page.goto('/detections')
  await page.getByRole('button', { name: /Voiture/ }).click()
  await page.getByRole('button', { name: 'Plus d’actions' }).click()
  return page.getByRole('dialog', { name: /Voiture/ })
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
            occurredAt: new Date(Date.now() - 60_000).toISOString(),
          }),
        ],
        clipsGone: ['event-1'],
      }),
    )
  })

  test('DetectionHistoryView_ShouldRemoveTheDetectionEverywhere_WhenTheUserConfirmsItsDeletion', async ({
    page,
  }) => {
    const actions = await openTheCarActions(page)
    await actions.getByRole('button', { name: 'Supprimer' }).click()

    const question = page.getByRole('alertdialog')
    await expect(question).toContainText('La détection et sa vidéo seront effacées.')
    await question.getByRole('button', { name: 'Supprimer' }).click()

    await expect(page.getByText('Détection supprimée.')).toBeVisible()
    await expect(page.getByRole('listitem')).toHaveCount(1)
    await expect(page.getByRole('listitem')).toContainText('front door')

    await page.reload()
    await expect(page.getByRole('listitem')).toHaveCount(1)
  })

  test('DetectionHistoryView_ShouldKeepTheDetection_WhenTheUserCancelsItsDeletion', async ({
    page,
  }) => {
    const actions = await openTheCarActions(page)
    await actions.getByRole('button', { name: 'Supprimer' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Annuler' }).click()

    await expect(page.getByRole('alertdialog')).toHaveCount(0)
    await expect(page.getByRole('listitem')).toHaveCount(2)
  })

  test('DetectionHistoryView_ShouldSayTheVideoWasDeleted_WhenItWasErasedWithAnotherDetection', async ({
    page,
  }) => {
    // The most recent detection opens in the player: its video answers that it is gone.
    await page.goto('/detections')

    await expect(page.getByText('La vidéo de ce moment a été supprimée.')).toBeVisible()
  })
})
