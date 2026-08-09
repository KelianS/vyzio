import { test, expect } from '@playwright/test'
import {
  installFakeBackend,
  createFakeBackendState,
  makeFakeDetectionEvent,
} from './fixtures/fakeBackend'

/**
 * What history becomes once it is only a read of the kept detections (ADR-49): past the retention
 * the media is gone (ADR-48), and the next page is asked for by cursor, never by number.
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
    // An erased media is not a failure: nothing to retry, so nothing to click.
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
