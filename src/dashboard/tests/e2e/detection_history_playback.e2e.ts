import { test, expect } from '@playwright/test'
import {
  installFakeBackend,
  createFakeBackendState,
  makeFakeCamera,
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

// A history longer than the screen, without videos, so no clip moves the list on its own.
const longHistory = Array.from({ length: 14 }, (_, index) =>
  makeFakeDetectionEvent({ eventId: `still-${index}`, occurredAt: minutesAgo(10 * (index + 1)) }),
)

// The player stays under the bar while the list scrolls, except on a phone on its side (HIST-18).
test.describe('DetectionHistoryView sticky player', () => {
  test.beforeEach(async ({ page }) => {
    await installFakeBackend(
      page,
      createFakeBackendState({
        // An offline camera puts an alert in the bar, making it taller.
        cameras: [makeFakeCamera({ displayName: 'Jardin', status: 'offline' })],
        detectionHistory: longHistory,
      }),
    )
  })

  test('DetectionHistoryView_ShouldKeepThePlayerUnderTheBar_WhenTheListScrollsOnAnUprightPhone', async ({
    page,
  }) => {
    await page.goto('/detections')
    const player = page.getByRole('group', { name: /^Détection :/ })
    await expect(page.getByText('Jardin ne répond plus')).toBeVisible()
    await expect(player).toBeVisible()

    await page.mouse.wheel(0, 800)
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(400)

    await expect(player).toBeInViewport({ ratio: 1 })
    const bar = (await page.locator('header').boundingBox())!
    const box = (await player.boundingBox())!
    expect(box.y).toBeGreaterThanOrEqual(bar.y + bar.height)
  })

  test('DetectionHistoryView_ShouldCapThePlayerAt40PercentOfTheScreen_WhenTheUprightScreenIsShort', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 480 })
    await page.goto('/detections')

    const box = (await page.getByRole('group', { name: /^Détection :/ }).boundingBox())!

    expect(box.height).toBeLessThanOrEqual(192)
  })

  test('DetectionHistoryView_ShouldScrollThePlayerAway_WhenThePhoneIsOnItsSide', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 844, height: 390 })
    await page.goto('/detections')
    const player = page.getByRole('group', { name: /^Détection :/ })
    await expect(player).toBeVisible()

    await page.mouse.wheel(0, 1200)
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(800)

    await expect(player).not.toBeInViewport()
  })
})
