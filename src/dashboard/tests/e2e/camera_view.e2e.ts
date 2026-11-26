import { test, expect } from '@playwright/test'
import {
  installFakeBackend,
  createFakeBackendState,
  makeFakeCamera,
  makeFakeDetectionEvent,
} from './fixtures/fake_backend'

const recent = () => new Date(Date.now() - 5 * 60 * 1000).toISOString()

test.use({ viewport: { width: 390, height: 844 } })

// More detections than the screen holds, without videos, so no clip moves the list on its own.
const longHistory = Array.from({ length: 14 }, (_, index) =>
  makeFakeDetectionEvent({
    eventId: `still-${index}`,
    camera: 'front_door',
    occurredAt: new Date(Date.now() - (index + 1) * 10 * 60 * 1000).toISOString(),
  }),
)

// The camera view: the picture, then Contrôles and Détections (LIVE-19, LIVE-20).
test.describe('Camera view', () => {
  test('CameraView_ShouldPlayTheDetectionInPlaceOfTheLiveThenGoBack_WhenTheUserTapsItThenRevenirAuDirect', async ({
    page,
  }) => {
    await installFakeBackend(
      page,
      createFakeBackendState({
        detectionHistory: [
          makeFakeDetectionEvent({
            eventId: 'e1',
            camera: 'front_door',
            identity: 'Camille',
            hasClip: true,
            occurredAt: recent(),
          }),
        ],
      }),
    )
    await page.goto('/')
    await page.getByRole('link', { name: 'Porte d’entrée' }).click()
    const live = page.locator('video[aria-label="Porte d’entrée"]')
    await expect(live).toBeVisible()

    await page.getByRole('tab', { name: /Détections/ }).click()
    await page.getByRole('button', { name: /Camille/ }).click()

    const clip = page.locator('video[aria-label="Camille"]')
    await expect(clip).toHaveAttribute('src', /\/api\/detection-events\/e1\/clip$/)
    await expect(live).toHaveCount(0)

    await page.getByRole('button', { name: 'Revenir au direct' }).click()

    await expect(live).toBeVisible()
    await expect(clip).toHaveCount(0)
  })

  test('CameraView_ShouldKeepTheClipPlayerUnderTheBar_WhenItsDetectionsScroll', async ({
    page,
  }) => {
    await installFakeBackend(
      page,
      createFakeBackendState({
        detectionHistory: [
          makeFakeDetectionEvent({ eventId: 'e0', camera: 'front_door', identity: 'Camille' }),
          ...longHistory,
        ],
      }),
    )
    await page.goto('/cameras/camera-1?tab=detections')
    await page.getByRole('button', { name: /Camille/ }).click()
    const player = page.getByRole('group', { name: /^Détection :/ })
    await expect(player).toBeVisible()

    await page.mouse.wheel(0, 800)
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(400)

    await expect(player).toBeInViewport({ ratio: 1 })
    const bar = (await page.locator('header').boundingBox())!
    const box = (await player.boundingBox())!
    expect(box.y).toBeGreaterThanOrEqual(bar.y + bar.height)
  })

  test('CameraView_ShouldPlayTheClipAtTheLiveSize_WhenTheListSitsBesideIt', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 })
    await installFakeBackend(
      page,
      createFakeBackendState({
        detectionHistory: [
          makeFakeDetectionEvent({ eventId: 'e0', camera: 'front_door', identity: 'Camille' }),
          ...longHistory,
        ],
      }),
    )
    await page.goto('/cameras/camera-1?tab=detections')
    const live = page.locator('video[aria-label="Porte d’entrée"]')
    await expect(live).toBeVisible()
    const liveBox = (await live.boundingBox())!

    await page.getByRole('button', { name: /Camille/ }).click()

    const clipBox = (await page.getByRole('group', { name: /^Détection :/ }).boundingBox())!
    expect(clipBox).toEqual(liveBox)
  })

  test('CameraView_ShouldOpenItsDetectionsAndComeBackToThem_WhenTheUserFollowsToutesSesDetections', async ({
    page,
  }) => {
    await installFakeBackend(
      page,
      createFakeBackendState({
        detectionHistory: [makeFakeDetectionEvent({ eventId: 'e1', camera: 'front_door' })],
      }),
    )
    await page.goto('/cameras/camera-1?tab=detections')

    await page.getByRole('link', { name: 'Toutes ses détections' }).click()
    await expect(page).toHaveURL('/detections?camera=camera-1')
    await page.getByRole('button', { name: 'Retour' }).click()

    await expect(page).toHaveURL('/cameras/camera-1?tab=detections')
    await expect(page.getByRole('tab', { name: /Détections/ })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })

  test('CameraView_ShouldSayItIsCutThenResumeWithoutAsking_WhenTheUserTapsReactivate', async ({
    page,
  }) => {
    await installFakeBackend(
      page,
      createFakeBackendState({ cameras: [makeFakeCamera({ privacyModeActive: true })] }),
    )
    await page.goto('/cameras/camera-1')
    await expect(page.getByText('Vyzio n’enregistre plus rien')).toBeVisible()

    await page.getByRole('button', { name: 'Réactiver' }).click()

    await expect(page.locator('video[aria-label="Porte d’entrée"]')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Couper la caméra' })).toBeVisible()
  })

  test('CameraView_ShouldSayWhyThereIsNoPicture_WhenTheUserOpensAnOfflineCamera', async ({
    page,
  }) => {
    await installFakeBackend(
      page,
      createFakeBackendState({ cameras: [makeFakeCamera({ status: 'offline' })] }),
    )
    await page.goto('/')

    await page.getByRole('link', { name: 'Porte d’entrée : Hors ligne' }).click()

    await expect(page.getByText(/Cette caméra ne répond pas/)).toBeVisible()
    await expect(page.locator('video')).toHaveCount(0)
  })
})
