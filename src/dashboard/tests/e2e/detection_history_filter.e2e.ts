import { test, expect } from '@playwright/test'
import {
  installFakeBackend,
  createFakeBackendState,
  makeFakeCamera,
  makeFakeDetectionEvent,
} from './fixtures/fake_backend'

test.use({ viewport: { width: 390, height: 844 } })

// The filter of the bar (HIST-03, HIST-18): a sheet naming the cameras as the user does.
test.describe('DetectionHistoryView filters', () => {
  test.beforeEach(async ({ page }) => {
    await installFakeBackend(
      page,
      createFakeBackendState({
        cameras: [
          makeFakeCamera(),
          makeFakeCamera({
            id: 'camera-2',
            slug: 'garage',
            displayName: 'Garage',
            frigateCameraName: 'cam_garage',
          }),
        ],
        detectionHistory: [
          makeFakeDetectionEvent({ cameraName: 'Porte d’entrée' }),
          makeFakeDetectionEvent({
            eventId: 'evt-2',
            camera: 'cam_garage',
            cameraName: 'Garage',
            label: 'car',
            occurredAt: new Date(Date.now() - 60_000).toISOString(),
          }),
        ],
      }),
    )
    await page.goto('/detections')
  })

  const rows = (page: import('@playwright/test').Page) => page.getByRole('listitem')

  test('DetectionHistoryView_ShouldNarrowTheListToOneCameraByItsName_WhenTheUserPicksItInTheSheet', async ({
    page,
  }) => {
    await expect(rows(page)).toHaveCount(2)

    await page.getByRole('banner').getByRole('button', { name: 'Filtrer' }).click()
    const sheet = page.getByRole('dialog', { name: 'Filtrer' })
    await expect(sheet.getByText('cam_garage')).toHaveCount(0)
    await sheet.getByRole('button', { name: 'Garage' }).click()

    await expect(sheet).toHaveCount(0)
    await expect(rows(page)).toHaveCount(1)
    await expect(rows(page)).toContainText('Garage')
  })

  test('DetectionHistoryView_ShouldNarrowTheListThenOfferAWayBack_WhenTheUserFiltersByType', async ({
    page,
  }) => {
    await page.getByRole('banner').getByRole('button', { name: 'Filtrer' }).click()
    await page
      .getByRole('dialog', { name: 'Filtrer' })
      .getByRole('button', { name: 'Voiture' })
      .click()
    await expect(rows(page)).toHaveCount(1)

    await page.getByRole('button', { name: 'Tout afficher' }).click()

    await expect(rows(page)).toHaveCount(2)
    await expect(page.getByRole('button', { name: 'Tout afficher' })).toHaveCount(0)
  })

  test('DetectionHistoryView_ShouldOpenOnThatCamera_WhenTheAddressNamesIt', async ({ page }) => {
    await page.goto('/detections?camera=camera-2')

    await expect(rows(page)).toHaveCount(1)
    await expect(rows(page)).toContainText('Garage')
  })
})
