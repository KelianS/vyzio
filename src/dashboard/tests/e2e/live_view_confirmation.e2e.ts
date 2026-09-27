import { test, expect, type Locator, type Page } from '@playwright/test'
import { installFakeBackend, createFakeBackendState, makeFakeCamera } from './fixtures/fake_backend'

function ptzCameraWithOneSavedPosition() {
  const state = createFakeBackendState({ cameras: [makeFakeCamera({ ptzSupported: true })] })
  state.ptz = {
    presets: [
      {
        presetId: 1,
        label: 'Surveillance',
        native: false,
        panMs: 3,
        tiltMs: 2,
        configured: true,
      },
    ],
    calibrated: true,
    currentPosition: { x: 7, y: 4 },
  }
  return state
}

// Whether the eye sees it: a modal turns hit testing off under it, so the probe lifts that briefly.
async function isOnTop(locator: Locator) {
  return locator.evaluate((element) => {
    const saved = document.body.style.pointerEvents
    document.body.style.pointerEvents = 'auto'
    const box = element.getBoundingClientRect()
    const top = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)
    document.body.style.pointerEvents = saved
    return element.contains(top)
  })
}

async function longPressTheSavedPosition(page: Page) {
  await page.getByRole('button', { name: 'Piloter la caméra' }).click()
  await page.getByTitle(/^Surveillance \(appui/).hover()
  await page.mouse.down()
  const question = page.getByRole('alertdialog', { name: 'Redéfinir cette position ?' })
  await expect.poll(() => isOnTop(question)).toBe(true)
  await page.mouse.up()
}

async function closeTheLiveView(page: Page) {
  const liveView = page.getByRole('dialog', { name: /^Pilotage/ })
  const cross = liveView.getByRole('button', { name: 'Fermer' })
  await expect.poll(() => isOnTop(cross)).toBe(true)
  await cross.click()
  await expect(liveView).toBeHidden()
}

// The question opened from the live view shows above it, on a phone (#216).
test.describe('Live view confirmation', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
  })

  test('LiveView_ShouldRedefineThePositionThenClose_WhenTheUserConfirmsTheLongPress', async ({
    page,
  }) => {
    const state = ptzCameraWithOneSavedPosition()
    await installFakeBackend(page, state)
    await page.goto('/settings/cameras/camera-1/image')

    await longPressTheSavedPosition(page)
    await page.getByRole('button', { name: 'Redéfinir' }).click()

    await expect(page.getByText('Position « Surveillance » enregistrée.')).toBeVisible()
    expect(state.ptz.presets).toEqual([
      expect.objectContaining({ presetId: 1, panMs: 7, tiltMs: 4 }),
    ])
    await closeTheLiveView(page)
  })

  test('LiveView_ShouldKeepThePositionThenClose_WhenTheUserCancelsTheLongPress', async ({
    page,
  }) => {
    const state = ptzCameraWithOneSavedPosition()
    await installFakeBackend(page, state)
    await page.goto('/settings/cameras/camera-1/image')

    await longPressTheSavedPosition(page)
    await page.getByRole('button', { name: 'Annuler' }).click()

    await expect(page.getByRole('alertdialog')).toBeHidden()
    expect(state.ptz.presets).toEqual([
      expect.objectContaining({ presetId: 1, panMs: 3, tiltMs: 2 }),
    ])
    await closeTheLiveView(page)
  })
})
