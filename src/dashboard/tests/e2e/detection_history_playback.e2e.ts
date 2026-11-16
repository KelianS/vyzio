import { test, expect } from '@playwright/test'
import {
  installFakeBackend,
  createFakeBackendState,
  makeFakeDetectionEvent,
} from './fixtures/fake_backend'

test.use({ viewport: { width: 390, height: 844 } })

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString()

// The player of the Détections page (HIST-18): a tap plays a clip, the next one follows on its own.
test.describe('DetectionHistoryView playback', () => {
  test.beforeEach(async ({ page }) => {
    await installFakeBackend(
      page,
      createFakeBackendState({
        detectionHistory: [
          makeFakeDetectionEvent({
            eventId: 'e1',
            identity: 'Camille',
            hasClip: true,
            occurredAt: minutesAgo(5),
          }),
          makeFakeDetectionEvent({
            eventId: 'e2',
            label: 'car',
            hasClip: true,
            occurredAt: minutesAgo(30),
          }),
        ],
      }),
    )
  })

  test('DetectionHistoryView_ShouldPlayTheNextClip_WhenAClipEnds', async ({ page }) => {
    await page.goto('/detections')
    const player = page.getByRole('group', { name: /^Détection :/ })
    await expect(player.locator('video')).toHaveAttribute('src', /\/e1\/clip$/)

    // The one-second scene ends by itself, with nothing to tap.
    await expect(player.locator('video')).toHaveAttribute('src', /\/e2\/clip$/, { timeout: 10_000 })
    await expect(page.getByRole('button', { name: /Voiture/ })).toHaveAttribute(
      'aria-current',
      'true',
    )
  })

  test('DetectionHistoryView_ShouldPlayTheTappedClip_WhenTheUserTapsItsRow', async ({ page }) => {
    await page.goto('/detections')

    await page.getByRole('button', { name: /Voiture/ }).click()

    await expect(
      page.getByRole('group', { name: /^Détection :/ }).locator('video'),
    ).toHaveAttribute('src', /\/e2\/clip$/)
  })
})
