import { test, expect, type Page } from '@playwright/test'
import { installFakeBackend, createFakeBackendState } from './fixtures/fake_backend'

async function openTheLiveView(page: Page, liveRefusal?: number) {
  const state = createFakeBackendState({ liveRefusal })
  await installFakeBackend(page, state)
  await page.goto('/')
  await page.getByRole('button', { name: 'Porte d’entrée' }).click()
  return state
}

// The live view plays the camera's stream, the low quality first (ADR-72).
test.describe('Live view video', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
  })

  test('LiveVideo_ShouldPlayTheLowQualityThenTheHighOne_WhenTheUserPressesHd', async ({ page }) => {
    const state = await openTheLiveView(page)

    const video = page.locator('video[aria-label="Porte d’entrée"]')
    await expect
      .poll(() => video.evaluate((v: HTMLVideoElement) => v.readyState))
      .toBeGreaterThanOrEqual(2)
    expect(state.liveSockets.at(-1)).toContain('/api/cameras/camera-1/live/ws?quality=low')

    await page.getByRole('button', { name: 'Haute qualité' }).click()

    await expect.poll(() => state.liveSockets.at(-1)).toContain('quality=high')
    await expect(page.getByRole('button', { name: 'Haute qualité' })).toHaveAttribute(
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
})
