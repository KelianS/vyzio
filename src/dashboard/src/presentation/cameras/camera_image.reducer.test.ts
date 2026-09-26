import { describe, expect, it } from 'vitest'
import { makeImageSettingsBinding } from '../../testing/capability_binding_fixture'
import { cameraImageReducer } from './camera_image.reducer'
import { buildInitialCameraImageUido } from './camera_image.uido'

describe('cameraImageReducer', () => {
  it.each([
    { bindings: [makeImageSettingsBinding('dvrip')], writable: false },
    { bindings: [makeImageSettingsBinding('onvif')], writable: true },
    { bindings: [], writable: true },
  ])(
    'cameraImageReducer_ShouldOfferSharpnessAndNightVisionOnlyWhereWritable_WhenTheBindingsLoad (writable: $writable)',
    ({ bindings, writable }) => {
      // Arrange
      const state = buildInitialCameraImageUido()

      // Act
      const next = cameraImageReducer(state, { type: 'BINDINGS_LOADED', bindings })

      // Assert
      expect(next.writableBeyondBasics).toBe(writable)
    },
  )
})
