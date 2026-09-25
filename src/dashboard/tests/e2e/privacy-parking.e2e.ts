import { test, expect } from '@playwright/test'
import { installFakeBackend, createFakeBackendState, makeFakeCamera } from './fixtures/fakeBackend'

const saved = (presetId: number) => ({
  presetId,
  label: `Position ${presetId}`,
  native: false,
  stepsX: 0,
  stepsY: 0,
  configured: true,
})

// Turning away promises a move there and back: both positions come first (ADR-57).
test.describe('Privacy parking', () => {
  test('CameraPrivacyPage_ShouldWithholdParkingAndSayWhatUnlocksIt_WhenThePositionsAreNotSaved', async ({
    page,
  }) => {
    const state = createFakeBackendState({ cameras: [makeFakeCamera({ ptzSupported: true })] })
    state.ptz.presets = [saved(1)]
    await installFakeBackend(page, state)
    await page.goto('/settings/cameras/camera-1/vie-privee')

    await page.getByRole('combobox').first().click()
    await expect(page.getByRole('option', { name: 'Arrêt logiciel' })).toBeVisible()
    await expect(page.getByRole('option', { name: 'Orientation à l’écart' })).toHaveCount(0)
    await page.keyboard.press('Escape')

    await page
      .getByRole('button', { name: /À quoi sert « Quand vous coupez la surveillance »/ })
      .click()
    await expect(
      page.getByText(/enregistrez d’abord ses positions Surveillance et Parking/),
    ).toBeVisible()
  })

  test('CameraPrivacyPage_ShouldOfferParking_WhenBothPositionsAreSaved', async ({ page }) => {
    const state = createFakeBackendState({ cameras: [makeFakeCamera({ ptzSupported: true })] })
    state.ptz.presets = [saved(1), saved(2)]
    await installFakeBackend(page, state)
    await page.goto('/settings/cameras/camera-1/vie-privee')

    await page.getByRole('combobox').first().click()

    await expect(page.getByRole('option', { name: 'Orientation à l’écart' })).toBeVisible()
  })
})
