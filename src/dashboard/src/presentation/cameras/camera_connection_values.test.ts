import { describe, expect, it } from 'vitest'
import { makeCamera } from '../../testing/camera_fixture'
import { makeCapabilityBinding } from '../../testing/capability_binding_fixture'
import { makeCameraProtocol } from '../../testing/camera_protocol_fixture'
import {
  connectionValuesOf,
  protocolInputOf,
  sameBox,
  type ProtocolValues,
} from './camera_connection_values'

const box: ProtocolValues = {
  port: 554,
  shownPort: 554,
  handPort: null,
  specificAccount: true,
  username: ' viewer ',
  password: '',
  deviceId: '',
}

describe('connectionValuesOf', () => {
  it('connectionValuesOf_ShouldFillTheBoxOfEachProtocolTheCameraSpeaks_WhenItsRowsAreRead', () => {
    // Arrange
    const protocols = [
      makeCameraProtocol({
        protocol: 'v380',
        effectivePort: 8800,
        deviceId: 26970853,
        hasSpecificAccount: true,
        username: 'viewer',
      }),
    ]

    // Act
    const values = connectionValuesOf(makeCamera(), undefined, protocols)

    // Assert
    expect(values['protocol:v380']).toEqual({
      port: 8800,
      shownPort: 8800,
      handPort: null,
      specificAccount: true,
      username: 'viewer',
      password: '',
      deviceId: '26970853',
    })
    expect(values['protocol:rtsp'].port).toBeNull()
  })

  it('connectionValuesOf_ShouldTakeTheStreamPathFromTheStreamCapability_WhenItHasOne', () => {
    // Arrange
    const stream = makeCapabilityBinding({
      capability: 'stream',
      protocol: 'rtsp',
      streamPath: '/stream1',
    })

    // Act
    const values = connectionValuesOf(makeCamera(), stream, [])

    // Assert
    expect(values.streamPath).toBe('/stream1')
  })
})

describe('protocolInputOf', () => {
  it('protocolInputOf_ShouldSendTheTrimmedAccountAndKeepThePassword_WhenTheSpecificAccountIsOnAndNoPasswordTyped', () => {
    // Arrange & Act
    const input = protocolInputOf(box)

    // Assert
    expect(input).toEqual({ port: null, username: 'viewer', password: null, deviceId: null })
  })

  it('protocolInputOf_ShouldKeepTheFoundPortUnset_WhenTheUserLeftItAsItWas', () => {
    // Arrange & Act
    const input = protocolInputOf({ ...box, port: 2020, shownPort: 2020, handPort: null })

    // Assert
    expect(input.port).toBeNull()
  })

  it('protocolInputOf_ShouldSendThePort_WhenTheUserChangedIt', () => {
    // Arrange & Act
    const input = protocolInputOf({ ...box, port: 8554 })

    // Assert
    expect(input.port).toBe(8554)
  })

  it('protocolInputOf_ShouldDropTheSpecificAccount_WhenItIsSwitchedOff', () => {
    // Arrange & Act
    const input = protocolInputOf({ ...box, specificAccount: false, password: 'typed' })

    // Assert
    expect(input.username).toBeNull()
    expect(input.password).toBeNull()
  })

  it('protocolInputOf_ShouldSendTheDeviceNumber_WhenOneIsTyped', () => {
    // Arrange & Act
    const input = protocolInputOf({ ...box, deviceId: '26970853' })

    // Assert
    expect(input.deviceId).toBe(26970853)
  })
})

describe('sameBox', () => {
  it.each([
    {
      name: 'sameBox_ShouldBeTrue_WhenEveryFieldIsBackToItsSavedValue',
      other: { ...box },
      expected: true,
    },
    {
      name: 'sameBox_ShouldBeFalse_WhenOneFieldDiffers',
      other: { ...box, port: 8554 },
      expected: false,
    },
  ])('$name', ({ other, expected }) => {
    // Arrange & Act
    const same = sameBox(box, other)

    // Assert
    expect(same).toBe(expected)
  })
})
