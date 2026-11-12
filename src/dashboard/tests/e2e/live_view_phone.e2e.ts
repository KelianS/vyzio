import { test, expect, type Locator, type Page } from '@playwright/test'
import { installFakeBackend, createFakeBackendState, makeFakeCamera } from './fixtures/fake_backend'

const START = '/api/cameras/camera-1/ptz/move/start'

function ptzCamera() {
  return createFakeBackendState({
    cameras: [makeFakeCamera({ ptzSupported: true, verifiedCapabilities: ['ptz'] })],
  })
}

function fourPositions() {
  const state = ptzCamera()
  state.ptz.presets = [
    { presetId: 1, label: 'Position 1', panMs: 1, tiltMs: 1, thumbnail: false },
    { presetId: 2, label: 'Position 2', panMs: 2, tiltMs: 2, thumbnail: false },
    { presetId: 3, label: 'Position 3', panMs: 3, tiltMs: 3, thumbnail: false },
    { presetId: 4, label: 'Position 4', panMs: 4, tiltMs: 4, thumbnail: false },
  ]
  return state
}

async function openTheLiveView(page: Page, state = ptzCamera()) {
  await installFakeBackend(page, state)
  await page.goto('/settings/cameras/camera-1/image')
  await page.getByRole('link', { name: 'Piloter la caméra' }).click()
  return state
}

// A finger dragged leftwards from the middle of an element, the way a phone sends it.
async function swipeLeftFrom(page: Page, element: Locator) {
  const box = await element.boundingBox()
  const x = Math.round((box?.x ?? 0) + (box?.width ?? 0) / 2)
  const y = Math.round((box?.y ?? 0) + (box?.height ?? 0) / 2)
  const finger = await page.context().newCDPSession(page)
  await finger.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
  await finger.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x: x - 40, y }],
  })
  await finger.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x: x - 80, y }],
  })
  await finger.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x: x - 120, y }],
  })
  await finger.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
}

// Whether a finger landing on its middle reaches it, rather than the joystick laid over it.
async function isOnTop(element: Locator) {
  return element.evaluate((target) => {
    const box = target.getBoundingClientRect()
    return target.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2))
  })
}

// What a finger does, not a mouse: the browser adds the mouse events it emulates after a tap.
test.use({ hasTouch: true })

test.describe('Live view on a phone', () => {
  test('Joystick_ShouldSendOneMove_WhenTheUserTapsADirectionWithAFinger', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await openTheLiveView(page)
    const starts: string[] = []
    page.on('request', (request) => {
      if (request.url().endsWith(START)) starts.push(request.url())
    })
    const stopped = page.waitForRequest('**/api/cameras/camera-1/ptz/move/stop')

    await page.getByTitle('Haut').tap()
    await stopped
    // Nothing on screen marks a second move: wait past where the emulated mouse would send it.
    await page.waitForTimeout(500)

    expect(starts).toHaveLength(1)
  })

  test('LiveView_ShouldNeitherReloadOnAPullNorZoomOnADoubleTap_WhenItIsShown', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await openTheLiveView(page)
    const root = page.locator('html')

    await expect(root).toHaveCSS('overscroll-behavior-y', 'none')
    await expect(page.getByRole('main')).toHaveCSS('touch-action', 'manipulation')

    await page.getByRole('button', { name: 'Retour' }).click()
    await expect(root).toHaveCSS('overscroll-behavior-y', 'auto')
  })

  test('PresetRow_ShouldBringTheLastPositionUnderTheFinger_WhenANarrowPhoneCutsTheRow', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 568 })
    await openTheLiveView(page, fourPositions())
    const last = page.getByTitle(/^Position 4 \(appui/)

    await swipeLeftFrom(page, page.getByTitle(/^Position 1 \(appui/))

    await expect(last).toBeInViewport({ ratio: 1 })
    await expect.poll(() => isOnTop(last)).toBe(true)
  })

  test('PresetRow_ShouldScrollInTheRoomTheJoystickLeaves_WhenASmallPhoneLiesOnItsSide', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 480, height: 320 })
    await openTheLiveView(page, fourPositions())
    const first = page.getByTitle(/^Position 1 \(appui/)
    const last = page.getByTitle(/^Position 4 \(appui/)

    await swipeLeftFrom(page, first)

    await expect(last).toBeInViewport({ ratio: 1 })
    await expect.poll(() => isOnTop(last)).toBe(true)
    const row = await first.locator('xpath=../..').boundingBox()
    const joystick = await page.getByTitle('Gauche').boundingBox()
    expect((row?.x ?? 0) + (row?.width ?? 0)).toBeLessThan(joystick?.x ?? 0)
  })
})
