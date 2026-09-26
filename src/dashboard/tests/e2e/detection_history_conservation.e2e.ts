import { test, expect } from '@playwright/test'
import {
  installFakeBackend,
  createFakeBackendState,
  makeFakeDetectionEvent,
} from './fixtures/fake_backend'

/**
 * What history becomes once it is only a read of the kept detections (ADR-49): past the retention
 * the media is gone (ADR-48), and the next page is asked for by cursor, never by number.
 */

const anHourBefore = (moment: Date, hours: number) =>
  new Date(moment.getTime() - hours * 3_600_000).toISOString()

test.describe('DetectionHistoryView retention', () => {
  test('DetectionHistoryView_ShouldSayTheMediaIsErased_WhenTheDetectionIsPastRetention', async ({
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
    // An erased media is not a failure: nothing to retry, so nothing to click.
    await expect(page.getByRole('button', { name: /Voir l’aperçu/ })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Vidéo' })).toHaveCount(0)
  })

  test('DetectionHistoryView_ShouldOfferThePreviewAndVideo_WhenTheDetectionIsStillKept', async ({
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

test.describe('DetectionHistoryView older pages', () => {
  test('DetectionHistoryView_ShouldAddTheOlderDetections_WhenTheUserAsksForMore', async ({
    page,
  }) => {
    const now = new Date()
    // A full page (the screen asks for 20) suggests more remain, and one more does.
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

    // The next slice adds to what was already read, it does not replace it.
    await expect(page.getByText(/camera 20 · /)).toBeVisible()
    await expect(page.getByText(/camera 0 · /)).toBeVisible()
    // Nothing older left: the button has no reason to exist any more.
    await expect(page.getByRole('button', { name: 'Voir plus ancien' })).toHaveCount(0)
  })

  test('DetectionHistoryView_ShouldNotOfferMore_WhenTheWholeHistoryFitsOnOnePage', async ({
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
