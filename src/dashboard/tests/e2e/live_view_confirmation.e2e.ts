import { test, expect, type Locator, type Page } from '@playwright/test'
import { installFakeBackend, createFakeBackendState, makeFakeCamera } from './fixtures/fake_backend'

function ptzCameraWithOneSavedPosition() {
  const state = createFakeBackendState({
    cameras: [makeFakeCamera({ ptzSupported: true, verifiedCapabilities: ['ptz'] })],
  })
  state.ptz = {
    presets: [
      {
        presetId: 1,
        label: 'Surveillance',
        panMs: 3,
        tiltMs: 2,
        thumbnail: false,
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
  await page.getByRole('link', { name: 'Piloter la caméra' }).click()
  await page.getByTitle(/^Surveillance \(appui/).hover()
  await page.mouse.down()
  const question = page.getByRole('alertdialog', { name: 'Redéfinir cette position ?' })
  await expect.poll(() => isOnTop(question)).toBe(true)
  await page.mouse.up()
}

// Back where the user came from: the camera's page, which reads where the camera stands again.
async function leaveTheLiveView(page: Page) {
  const back = page.getByRole('button', { name: 'Retour' })
  await expect.poll(() => isOnTop(back)).toBe(true)
  await back.click()
  await expect(page).toHaveURL('/settings/cameras/camera-1/image')
  await expect(page.getByRole('link', { name: 'Piloter la caméra' })).toBeVisible()
}

// The question opened from the live view shows above it, on a phone (#216).
test.describe('Live view confirmation', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
  })

  test('LiveView_ShouldRedefineThePositionThenGoBack_WhenTheUserConfirmsTheLongPress', async ({
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
    await leaveTheLiveView(page)
  })

  test('LiveView_ShouldKeepThePositionThenGoBack_WhenTheUserCancelsTheLongPress', async ({
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
    await leaveTheLiveView(page)
  })
})
