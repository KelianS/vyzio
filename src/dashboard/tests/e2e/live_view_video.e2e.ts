import { test, expect, type Locator, type Page } from '@playwright/test'
import {
  installFakeBackend,
  createFakeBackendState,
  type FakeBackendState,
} from './fixtures/fake_backend'

const UPRIGHT = { width: 390, height: 844 }
const ON_ITS_SIDE = { width: 844, height: 390 }

async function openTheLiveView(page: Page, liveRefusal?: number) {
  return openTheLiveViewOf(page, { liveRefusal })
}

async function openTheLiveViewOf(page: Page, overrides: Partial<FakeBackendState>) {
  const state = createFakeBackendState(overrides)
  await installFakeBackend(page, state)
  await page.goto('/')
  await page.getByRole('link', { name: 'Porte d’entrée' }).click()
  return state
}

// Enough of the stream has arrived for the picture to show.
async function expectPlaying(video: Locator) {
  await expect
    .poll(() => video.evaluate((v: HTMLVideoElement) => v.readyState))
    .toBeGreaterThanOrEqual(2)
}

function userSelectOf(locator: Locator) {
  return locator.evaluate((element) => getComputedStyle(element).userSelect)
}

// The live view plays the camera's stream, the low quality first (ADR-07).
test.describe('Live view video', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(UPRIGHT)
  })

  test('LiveVideo_ShouldPlayTheLowQualityThenTheHighOne_WhenTheUserPressesHd', async ({ page }) => {
    const state = await openTheLiveView(page)

    const video = page.locator('video[aria-label="Porte d’entrée"]')
    await expect
      .poll(() => video.evaluate((v: HTMLVideoElement) => v.readyState))
      .toBeGreaterThanOrEqual(2)
    expect(state.liveSockets.at(-1)).toContain('/api/cameras/camera-1/live/ws?quality=low')

    await page.getByRole('button', { name: 'HD haute qualité' }).click()

    await expect.poll(() => state.liveSockets.at(-1)).toContain('quality=high')
    await expect(page.getByRole('button', { name: 'HD haute qualité' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  test('LiveVideo_ShouldShowTheRefreshedPictureAndSayWhy_WhenTheStreamDoesNotArrive', async ({
    page,
  }) => {
    await openTheLiveView(page, 4503)

    await expect(
      page.getByText('La vidéo n’arrive pas : image rafraîchie chaque seconde.'),
    ).toBeVisible()
    await expect(page.getByRole('img', { name: 'Porte d’entrée' }).last()).toBeVisible()
  })

  test('LiveVideo_ShouldSayTheCameraNoLongerAnswersThenResume_WhenTheCameraStopsSendingThenComesBack', async ({
    page,
  }) => {
    const state = await openTheLiveView(page)
    const video = page.locator('video[aria-label="Porte d’entrée"]')
    await expect
      .poll(() => video.evaluate((v: HTMLVideoElement) => v.readyState))
      .toBeGreaterThanOrEqual(2)
    const lost = page.getByText('Cette caméra ne répond plus : la vidéo reprendra dès son retour.')

    state.liveSilent = true

    await expect(lost).toBeVisible({ timeout: 10_000 })
    await expect(video).toBeHidden()

    state.liveSilent = false

    await expect(lost).toBeHidden({ timeout: 20_000 })
    await expect(video).toBeVisible()
  })

  test('LiveVideo_ShouldKeepPlaying_WhenThePhoneTurnsOnItsSideAndBack', async ({ page }) => {
    await openTheLiveView(page)
    const video = page.locator('video[aria-label="Porte d’entrée"]')
    await expectPlaying(video)

    await page.setViewportSize(ON_ITS_SIDE)
    await expectPlaying(video)
    await expect(video).toBeVisible()

    await page.setViewportSize(UPRIGHT)
    await expectPlaying(video)
    await expect(video).toBeVisible()
  })

  test('LiveVideo_ShouldFillTheWidthWithoutBandsNorCrop_WhenTheCameraFilmsInFourThirds', async ({
    page,
  }) => {
    await openTheLiveViewOf(page, { liveFourThirds: true })
    const video = page.locator('video[aria-label="Porte d’entrée"]')
    await expectPlaying(video)

    await expect
      .poll(async () => {
        const frame = await video.boundingBox()
        return frame && Math.round(frame.height)
      })
      .toBe(293)
    const frame = await video.boundingBox()
    expect(frame?.width).toBe(UPRIGHT.width)
    expect(await video.evaluate((v: HTMLVideoElement) => getComputedStyle(v).objectFit)).toBe(
      'contain',
    )
  })

  test('LiveView_ShouldGiveTheBrowserBarsBackAndKeepPlaying_WhenTheUserLeavesFullScreen', async ({
    page,
  }) => {
    await page.setViewportSize(ON_ITS_SIDE)
    await openTheLiveView(page)
    const video = page.locator('video[aria-label="Porte d’entrée"]')
    await expectPlaying(video)
    await page.getByRole('main', { name: 'Porte d’entrée' }).click()
    await expect.poll(() => page.evaluate(() => document.fullscreenElement !== null)).toBe(true)

    await page.getByRole('button', { name: 'Quitter le plein écran' }).click()

    await expect.poll(() => page.evaluate(() => document.fullscreenElement === null)).toBe(true)
    await expect(page.getByRole('main', { name: 'Porte d’entrée' })).toBeVisible()
    await expectPlaying(video)
  })

  test('LiveView_ShouldKeepItsControlsUnselectableAndItsSentencesSelectable_WhenPressed', async ({
    page,
  }) => {
    await openTheLiveView(page, 4503)
    const sentence = page.getByText('La vidéo n’arrive pas : image rafraîchie chaque seconde.')
    await expect(sentence).toBeVisible()

    expect(await userSelectOf(page.getByRole('button', { name: 'Retour' }))).toBe('none')
    expect(await userSelectOf(page.getByText('Porte d’entrée', { exact: true }))).toBe('none')
    expect(await userSelectOf(page.getByRole('button', { name: 'Réessayer' }))).toBe('none')
    expect(await userSelectOf(sentence)).not.toBe('none')
  })
})
