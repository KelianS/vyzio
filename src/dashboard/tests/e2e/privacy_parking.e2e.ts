import { test, expect } from '@playwright/test'
import { installFakeBackend, createFakeBackendState, makeFakeCamera } from './fixtures/fake_backend'

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
  test('CameraPrivacyView_ShouldListParkingGreyedWithWhereToSaveThePositions_WhenTheyAreNotSaved', async ({
    page,
  }) => {
    const state = createFakeBackendState({
      cameras: [makeFakeCamera({ ptzSupported: true, verifiedCapabilities: ['ptz'] })],
    })
    state.ptz.presets = [saved(1)]
    await installFakeBackend(page, state)
    await page.goto('/settings/cameras/camera-1/vie-privee')

    await page.getByRole('combobox', { name: 'En mode vie privée' }).click()

    // Listed, never hidden: a greyed option says what the camera could do and how (SPECS 9.3).
    const parking = page.getByRole('option', { name: /Orientation à l’écart/ })
    await expect(parking).toBeVisible()
    await expect(parking).toHaveAttribute('aria-disabled', 'true')
    await expect(parking).toContainText(
      'Enregistrez d’abord ses positions Surveillance et Parking dans « Image et pilotage ».',
    )
  })

  test('CameraPrivacyView_ShouldOfferParking_WhenBothPositionsAreSaved', async ({ page }) => {
    const state = createFakeBackendState({
      cameras: [makeFakeCamera({ ptzSupported: true, verifiedCapabilities: ['ptz'] })],
    })
    state.ptz.presets = [saved(1), saved(2)]
    await installFakeBackend(page, state)
    await page.goto('/settings/cameras/camera-1/vie-privee')

    await page.getByRole('combobox', { name: 'En mode vie privée' }).click()

    await expect(page.getByRole('option', { name: 'Orientation à l’écart' })).toBeEnabled()
  })
})
