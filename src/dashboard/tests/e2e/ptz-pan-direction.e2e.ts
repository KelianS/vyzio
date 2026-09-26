import { test, expect } from '@playwright/test'
import { installFakeBackend, createFakeBackendState, makeFakeCamera } from './fixtures/fakeBackend'

// Vyzio does not guess which way a camera turns: the user swaps left and right on its PTZ (SPECS 11).
test.describe('PTZ pan direction', () => {
  test('CapabilitySection_ShouldSwapLeftAndRight_WhenTheUserTurnsTheSettingOn', async ({
    page,
  }) => {
    const state = createFakeBackendState({ cameras: [makeFakeCamera({ ptzSupported: true })] })
    state.ptzBinding = { protocol: 'onvif', configJson: '{"supports_native_presets":true}' }
    await installFakeBackend(page, state)
    await page.goto('/settings/cameras/camera-1/connexion')

    const setting = page.getByRole('switch', { name: /Inverser gauche et droite/ })
    await expect(setting).not.toBeChecked()
    await setting.click()

    await expect(page.getByText('Gauche et droite inversés.')).toBeVisible()
    await expect(setting).toBeChecked()
    expect(JSON.parse(state.ptzBinding.configJson!)).toEqual({
      supports_native_presets: true,
      pan_inverted: true,
    })
  })
})
