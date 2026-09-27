import { test, expect, type Page } from '@playwright/test'
import { installFakeBackend, createFakeBackendState, makeFakeCamera } from './fixtures/fake_backend'

async function openTheLiveView(page: Page) {
  const state = createFakeBackendState({ cameras: [makeFakeCamera({ ptzSupported: true })] })
  await installFakeBackend(page, state)
  await page.goto('/settings/cameras/camera-1/image')
  await page.getByRole('button', { name: 'Piloter la caméra' }).click()
  return state
}

// A held direction is one move, signalled while held and stopped on release; a tap is one short move (ADR-60).
test.describe('Live view joystick', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
  })

  test('Joystick_ShouldStartSignalAndStopOneMove_WhenTheUserHoldsADirection', async ({ page }) => {
    const state = await openTheLiveView(page)
    const started = page.waitForRequest('**/api/cameras/camera-1/ptz/move/start')
    const signalled = page.waitForRequest('**/api/cameras/camera-1/ptz/move/signal')

    await page.getByTitle('Haut').hover()
    await page.mouse.down()
    expect((await started).postDataJSON()).toEqual({ direction: 'Up', speed: 50 })
    await signalled
    const stopped = page.waitForRequest('**/api/cameras/camera-1/ptz/move/stop')
    await page.mouse.up()
    await stopped

    await expect.poll(() => state.ptz.holding).toBe(false)
  })

  test('Joystick_ShouldSendOneShortMove_WhenTheUserTapsADirection', async ({ page }) => {
    await openTheLiveView(page)
    const tapped = page.waitForRequest('**/api/cameras/camera-1/ptz/step')

    await page.getByTitle('Gauche').click()

    expect((await tapped).postDataJSON()).toEqual({ direction: 'Left', speed: 50 })
  })
})
