import { test, expect } from '@playwright/test'
import { installFakeBackend, createFakeBackendState } from './fixtures/fakeBackend'

test.describe('DetectionHistory — filter', () => {
  test('user_When filtering by detection type_Should narrow the results table', async ({
    page,
  }) => {
    await installFakeBackend(
      page,
      createFakeBackendState({
        detectionHistory: [
          {
            eventId: 'evt-1',
            frigateEventId: 'frigate-1',
            lifecycle: 'end',
            camera: 'front_door',
            label: 'person',
            identity: null,
            profileId: null,
            confidence: 0.92,
            occurredAt: new Date().toISOString(),
            hasClip: false,
            hasSnapshot: false,
          },
          {
            eventId: 'evt-2',
            frigateEventId: 'frigate-2',
            lifecycle: 'end',
            camera: 'garage',
            label: 'car',
            identity: null,
            profileId: null,
            confidence: 0.81,
            occurredAt: new Date().toISOString(),
            hasClip: false,
            hasSnapshot: false,
          },
        ],
      }),
    )

    await page.goto('/history')
    await expect(page.getByRole('heading', { name: 'Historique des detections' })).toBeVisible()
    await expect(page.getByText('2 detections')).toBeVisible()
    await expect(page.getByText('front_door')).toBeVisible()
    await expect(page.getByText('garage')).toBeVisible()

    await page
      .locator('.camera-form-field', { hasText: 'Type' })
      .locator('select')
      .selectOption({ label: '🚗 Voiture' })

    await expect(page.getByText('garage')).toBeVisible()
    await expect(page.getByText('front_door')).toBeHidden()
  })
})
