import { test, expect, type Page } from '@playwright/test'
import {
  installFakeBackend,
  createFakeBackendState,
  makeFakeCamera,
  makeFakeDetectionEvent as makeEvent,
} from './fixtures/fake_backend'

/**
 * The defects found in use after the `config-ui` batch. Each one is reproduced here before
 * being fixed.
 */

test.describe('LiveView', () => {
  test('LiveView_ShouldOpenTheCameraViewUnderTheBarAndGoBackHome_WhenTheUserTapsACamera', async ({
    page,
  }) => {
    const camera = makeFakeCamera({ id: 'camera-1', displayName: 'Salon' })
    await installFakeBackend(page, createFakeBackendState({ cameras: [camera] }))

    await page.goto('/')
    await page.getByRole('link', { name: 'Salon' }).click()

    await expect(page).toHaveURL('/cameras/camera-1')
    await expect(page.getByRole('main', { name: 'Salon' })).toBeVisible()
    await expect(page.getByRole('banner').getByRole('heading', { name: 'Salon' })).toBeVisible()

    await page.getByRole('button', { name: 'Retour' }).click()
    await expect(page).toHaveURL('/')
  })

  test('LiveView_ShouldPutTheBarAboveThePicture_WhenThePhoneIsHeldUpright', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    const camera = makeFakeCamera({ id: 'camera-1', displayName: 'Salon' })
    await installFakeBackend(page, createFakeBackendState({ cameras: [camera] }))

    await page.goto('/cameras/camera-1')
    const back = await page.getByRole('button', { name: 'Retour' }).boundingBox()
    const picture = await page.locator('video[aria-label="Salon"]').boundingBox()

    expect(back!.y + back!.height).toBeLessThanOrEqual(picture!.y)
    expect(picture!.width).toBe(390 - 32)
  })

  // One round pad, its four directions each a finger's size (#389).
  test('LiveView_ShouldDrawThePadAsOneRoundControlWithFingerSizedZones_WhenThePhoneIsHeldUpright', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    const state = createFakeBackendState({
      cameras: [makeFakeCamera({ ptzSupported: true, verifiedCapabilities: ['ptz'] })],
    })
    await installFakeBackend(page, state)

    await page.goto('/cameras/camera-1')
    const pad = page.getByRole('group', { name: 'Orienter la caméra' })
    await expect(pad).toBeVisible()

    const reach = async (name: string) => {
      const zone = await pad.getByRole('button', { name }).boundingBox()
      return Math.min(zone!.width, zone!.height)
    }

    await expect(pad).toHaveCSS('border-radius', '9999px')
    expect(await reach('Haut')).toBeGreaterThanOrEqual(44)
    expect(await reach('Bas')).toBeGreaterThanOrEqual(44)
    expect(await reach('Gauche')).toBeGreaterThanOrEqual(44)
    expect(await reach('Droite')).toBeGreaterThanOrEqual(44)
  })

  test('LiveView_ShouldGoBackHome_WhenTheBrowserGoesBack', async ({ page }) => {
    const camera = makeFakeCamera({ id: 'camera-1', displayName: 'Salon' })
    await installFakeBackend(page, createFakeBackendState({ cameras: [camera] }))

    await page.goto('/')
    await page.getByRole('link', { name: 'Salon' }).click()
    await expect(page).toHaveURL('/cameras/camera-1')
    await page.goBack()

    await expect(page).toHaveURL('/')
    await expect(page.getByRole('link', { name: 'Salon' })).toBeVisible()
  })

  test('LiveView_ShouldFadeItsControlsAndBringThemBackOnATap_WhenThePhoneIsHeldLandscape', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 844, height: 390 })
    const camera = makeFakeCamera({ id: 'camera-1', displayName: 'Salon' })
    await installFakeBackend(page, createFakeBackendState({ cameras: [camera] }))

    await page.goto('/cameras/camera-1')
    const leave = page.getByRole('button', { name: 'Quitter le plein écran' })
    await expect(leave).toBeVisible()
    await expect(leave).toBeHidden({ timeout: 6000 })

    await page.mouse.click(420, 200)
    await expect(leave).toBeVisible()
  })

  test('LiveView_ShouldShowAWaitNeverABrokenImage_WhenTheStreamIsUnavailable', async ({ page }) => {
    const camera = makeFakeCamera({ id: 'camera-1', displayName: 'Salon' })
    await installFakeBackend(page, createFakeBackendState({ cameras: [camera] }))
    // What a surveillance restart does: the image does not arrive.
    await page.route('**/live/latest.jpg**', (route) => route.abort())

    await page.goto('/')

    await expect(page.getByText('Reconnexion…').first()).toBeVisible()
    // An image with no data carries the browser's broken icon: it must not show through.
    await expect(page.locator('article img')).not.toBeVisible()
    // And the thumbnail stays openable: hiding the image must not take its name away.
    await expect(page.getByRole('link', { name: 'Salon' })).toBeVisible()
  })
})

test.describe('LiveView PTZ positions', () => {
  async function openLive(
    page: Page,
    ptz: Partial<ReturnType<typeof createFakeBackendState>['ptz']> = {},
  ) {
    const state = createFakeBackendState({
      cameras: [
        makeFakeCamera({
          id: 'camera-1',
          displayName: 'Salon',
          ptzSupported: true,
          verifiedCapabilities: ['ptz'],
        }),
      ],
    })
    state.ptz = { ...state.ptz, ...ptz }
    await installFakeBackend(page, state)

    await page.goto('/')
    await page.getByRole('link', { name: 'Salon' }).click()
    return state
  }

  test('LiveView_ShouldSaveTheFirstPositionWithAPlainTap_WhenNoneIsSavedYet', async ({ page }) => {
    const state = await openLive(page)

    // The long press is the overwrite gesture; there is nothing to overwrite.
    await page.getByTitle('Enregistrer la position actuelle ici').first().click()

    await expect(
      page.getByRole('region', { name: 'Notifications' }).getByRole('status'),
    ).toContainText('enregistrée')
    expect(state.ptz.presets).toHaveLength(1)
  })

  // A position saved in the vendor app is held, never empty; a tap goes there and takes its thumbnail (ADR-09).
  test('LiveView_ShouldGoToTheHeldPositionAndTakeItsThumbnail_WhenTheCameraHeldItWithoutOne', async ({
    page,
  }) => {
    const state = await openLive(page, {
      presets: [{ presetId: 2, label: 'Parking', panMs: null, tiltMs: null, thumbnail: false }],
      currentPosition: null,
    })

    const tile = page.getByTitle(/^Parking \(appui : y aller et prendre sa miniature/)
    await expect(page.getByTitle('Enregistrer la position actuelle ici')).toHaveCount(1)

    await tile.click()

    await expect(
      page.getByRole('region', { name: 'Notifications' }).getByRole('status'),
    ).toContainText('Caméra en position « Parking ».')
    // The capture waits CAPTURE_DELAY_MS after the acknowledgement, on the real clock here.
    await expect.poll(() => state.ptz.presets[0].thumbnail, { timeout: 10_000 }).toBe(true)
    await expect(page.getByTitle(/^Parking \(appui : y aller, appui long/)).toBeVisible()
  })

  test('LiveView_ShouldAcknowledgeAndMarkThePosition_WhenTheUserGoesToIt', async ({ page }) => {
    await openLive(page, {
      presets: [
        {
          presetId: 1,
          label: 'Surveillance',
          panMs: 4,
          tiltMs: 2,
          thumbnail: false,
        },
      ],
      currentPosition: { x: 0, y: 0 },
    })

    const tile = page.getByTitle(/^Surveillance \(appui/)
    await expect(tile).toHaveAttribute('aria-pressed', 'false')

    await tile.click()

    // A move takes time: without an acknowledgement, the press looks like it did nothing.
    await expect(
      page.getByRole('region', { name: 'Notifications' }).getByRole('status'),
    ).toContainText('Caméra en position « Surveillance ».')
    await expect(tile).toHaveAttribute('aria-pressed', 'true')
  })

  test('LiveView_ShouldSayWhyAndOfferACalibration_WhenTheCameraHasNoReference', async ({
    page,
  }) => {
    const state = await openLive(page, { calibrated: false, currentPosition: null })

    await expect(page.getByText(/pas de position de référence/)).toBeVisible()

    await page.getByRole('button', { name: 'Calibrer maintenant' }).click()
    await expect(
      page.getByRole('region', { name: 'Notifications' }).getByRole('status'),
    ).toContainText('Caméra calibrée')
    expect(state.ptz.calibrated).toBe(true)

    // And the positions become usable again without going through the settings.
    await page.getByTitle('Enregistrer la position actuelle ici').first().click()
    await expect(
      page.getByRole('region', { name: 'Notifications' }).getByRole('status').last(),
    ).toContainText('enregistrée')
  })
})

test.describe('DetectionHistoryView', () => {
  async function openHistory(page: Page) {
    await installFakeBackend(
      page,
      createFakeBackendState({
        detectionHistory: [makeEvent(), makeEvent({ eventId: 'event-2' })],
      }),
    )
    await page.goto('/detections')
  }

  test('DetectionHistoryView_ShouldShowDetectionsWithTheFilterInTheBar_WhenOpened', async ({
    page,
  }) => {
    await openHistory(page)

    await expect(page.getByRole('heading', { name: 'Détections' })).toBeVisible()

    // What one comes to read here is the detections - not a filter form.
    await expect(page.getByRole('dialog', { name: 'Filtrer' })).toHaveCount(0)
    await page.getByRole('banner').getByRole('button', { name: 'Filtrer' }).click()
    await expect(page.getByRole('dialog', { name: 'Filtrer' })).toBeVisible()
  })

  test('DetectionHistoryView_ShouldShowTheThumbnailAndSummary_WhenItListsDetections', async ({
    page,
  }) => {
    await openHistory(page)

    const row = page.getByRole('listitem').first()
    await expect(row.locator('img')).toBeAttached()
    await expect(row).toContainText(/front door · \d+\sh/)
    await expect(page.getByRole('group', { name: /^Détection :/ })).toContainText(
      /front door · .* · sûr\sà\s92\s%/,
    )
  })
})
