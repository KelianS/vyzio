import { test, expect } from '@playwright/test'
import {
  installFakeBackend,
  createFakeBackendState,
  makeFakeDetectionEvent,
} from './fixtures/fakeBackend'

/**
 * Ce que l'historique devient une fois qu'il n'est plus qu'une lecture des detections conservees
 * (ADR-49) : au-dela de la duree de conservation le media n'existe plus (ADR-48), et une page
 * suivante se demande par curseur, sans numero.
 */

const anHourBefore = (moment: Date, hours: number) =>
  new Date(moment.getTime() - hours * 3_600_000).toISOString()

test.describe('Historique — conservation', () => {
  test('user_When a detection is older than what is kept_Should be told, not shown a broken image', async ({
    page,
  }) => {
    await installFakeBackend(
      page,
      createFakeBackendState({
        detectionHistory: [
          makeFakeDetectionEvent({
            eventId: 'event-expire',
            hasClip: true,
            hasSnapshot: true,
            mediaExpired: true,
          }),
        ],
      }),
    )
    await page.goto('/history')

    await expect(page.getByText(/Aperçu et vidéo effacés/)).toBeVisible()
    // Un media efface n'est pas une panne : il n'y a rien a retenter, donc rien a cliquer.
    await expect(page.getByRole('button', { name: /Voir l’aperçu/ })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Vidéo' })).toHaveCount(0)
  })

  test('user_When a detection is still kept_Should be able to open its preview', async ({
    page,
  }) => {
    await installFakeBackend(
      page,
      createFakeBackendState({
        detectionHistory: [makeFakeDetectionEvent({ hasClip: true, hasSnapshot: true })],
      }),
    )
    await page.goto('/history')

    await expect(page.getByText(/Aperçu et vidéo effacés/)).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Voir l’aperçu/ })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Vidéo' })).toBeVisible()
  })
})

test.describe('Historique — remonter le temps', () => {
  test('user_When more detections remain_Should reach the older ones without a page number', async ({
    page,
  }) => {
    const now = new Date()
    // Une page pleine (la limite de l'ecran est 20) laisse croire qu'il en reste, une de plus suit.
    const history = Array.from({ length: 21 }, (_, index) =>
      makeFakeDetectionEvent({
        eventId: `event-${index}`,
        cameraName: `camera ${index}`,
        occurredAt: anHourBefore(now, index),
      }),
    )
    await installFakeBackend(page, createFakeBackendState({ detectionHistory: history }))
    await page.goto('/history')

    await expect(page.getByText(/camera 0 · /)).toBeVisible()
    await expect(page.getByText(/camera 20 · /)).toHaveCount(0)

    await page.getByRole('button', { name: 'Voir plus ancien' }).click()

    // La suite s'ajoute a ce qui est deja lu, elle ne le remplace pas.
    await expect(page.getByText(/camera 20 · /)).toBeVisible()
    await expect(page.getByText(/camera 0 · /)).toBeVisible()
    // Plus rien de plus ancien : le bouton n'a plus de raison d'etre.
    await expect(page.getByRole('button', { name: 'Voir plus ancien' })).toHaveCount(0)
  })

  test('user_When the whole history fits on one page_Should not be offered more', async ({
    page,
  }) => {
    await installFakeBackend(
      page,
      createFakeBackendState({ detectionHistory: [makeFakeDetectionEvent()] }),
    )
    await page.goto('/history')

    await expect(page.getByRole('button', { name: 'Voir plus ancien' })).toHaveCount(0)
  })
})
