import { describe, expect, it } from 'vitest'
import { makeCameraProtocol } from '../../testing/camera_protocol_fixture'
import { protocolOptions } from './protocol_labels'

describe('protocolOptions', () => {
  it('protocolOptions_ShouldMarkOnlyTheDefaultProtocol_WhenTheCapabilityHasOne', () => {
    // Arrange
    const protocols = [makeCameraProtocol(), makeCameraProtocol({ protocol: 'dvrip' })]

    // Act
    const options = protocolOptions('stream', protocols, null)

    // Assert
    expect(options.map((option) => option.label)).toEqual(['RTSP (par défaut)', 'DVRIP'])
  })

  it('protocolOptions_ShouldOfferTheCurrentProtocol_WhenTheCameraHasNoRowForIt', () => {
    // Arrange
    const protocols = [makeCameraProtocol({ protocol: 'onvif' })]

    // Act
    const options = protocolOptions('image_settings', protocols, 'dvrip')

    // Assert
    expect(options.map((option) => option.label)).toEqual(['ONVIF', 'DVRIP'])
  })

  it('protocolOptions_ShouldOfferNothing_WhenNoProtocolOfTheCameraCarriesTheCapability', () => {
    // Arrange
    const protocols = [makeCameraProtocol()]

    // Act
    const options = protocolOptions('hardware_privacy', protocols, null)

    // Assert
    expect(options).toEqual([])
  })
})
