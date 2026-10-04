import { describe, expect, it } from 'vitest'
import { makeCamera } from '../../testing/camera_fixture'
import { OrientationControl, orientationControlOf } from './orientation_control'

describe('orientationControlOf', () => {
  it.each([
    { ptzSupported: false, verifiedCapabilities: ['ptz'], expected: OrientationControl.Off },
    { ptzSupported: false, verifiedCapabilities: [], expected: OrientationControl.Off },
    { ptzSupported: true, verifiedCapabilities: ['ptz'], expected: OrientationControl.Usable },
    { ptzSupported: true, verifiedCapabilities: [], expected: OrientationControl.Unusable },
    {
      ptzSupported: true,
      verifiedCapabilities: ['image_settings'],
      expected: OrientationControl.Unusable,
    },
  ])(
    'orientationControlOf_ShouldReturn$expected_WhenInUseIs$ptzSupportedAndVerifiedAre$verifiedCapabilities',
    ({ ptzSupported, verifiedCapabilities, expected }) => {
      // Arrange
      const camera = makeCamera({ ptzSupported, verifiedCapabilities })

      // Act
      const control = orientationControlOf(camera)

      // Assert
      expect(control).toBe(expected)
    },
  )
})
