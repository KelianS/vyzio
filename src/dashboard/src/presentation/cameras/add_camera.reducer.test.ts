import { describe, expect, it } from 'vitest'
import type { DiscoveredCamera } from '../../domain/entities/discovered_camera.entity'
import { addCameraReducer } from './add_camera.reducer'
import { buildInitialAddCameraUido } from './add_camera.uido'

const candidate: DiscoveredCamera = {
  displayName: 'Garage',
  host: '192.168.1.40',
  port: 554,
  sourceType: 'onvif',
  streamPath: '/stream1',
  rtspActive: true,
  discoverySource: 'onvif',
  note: null,
  macAddress: null,
  isSupported: true,
  qualification: 'camera_confirmed',
  supportLevel: 'supported',
  vendorFamily: 'tplink_tapo',
  qualificationReasons: [],
}

const verified = {
  ...buildInitialAddCameraUido(),
  selection: { kind: 'manual' as const },
  verification: { connected: true, guidance: null },
}

describe('addCameraReducer', () => {
  it('addCameraReducer_ShouldDropTheVerification_WhenTheFormIsEdited', () => {
    // Arrange
    const action = { type: 'FORM_UPDATED', patch: { host: '192.168.1.41' } } as const

    // Act
    const next = addCameraReducer(verified, action)

    // Assert
    expect(next.form.host).toBe('192.168.1.41')
    expect(next.verification).toBeNull()
  })

  it('addCameraReducer_ShouldFillTheFormButKeepTheCredentials_WhenACandidateIsChosen', () => {
    // Arrange
    const typed = { ...verified, form: { ...verified.form, username: 'user', password: 'secret' } }

    // Act
    const next = addCameraReducer(typed, { type: 'CANDIDATE_SELECTED', index: 0, candidate })

    // Assert
    expect(next.form).toMatchObject({
      host: '192.168.1.40',
      streamPath: '/stream1',
      username: 'user',
      password: 'secret',
    })
    expect(next.selection).toEqual({ kind: 'candidate', index: 0 })
  })

  it('addCameraReducer_ShouldSwitchToTheDvripPort_WhenTheFallbackIsTurnedOn', () => {
    // Arrange
    const action = {
      type: 'DVRIP_MODE_TOGGLED',
      enabled: true,
      fallbackPort: 554,
      fallbackStreamPath: '/stream1',
    } as const

    // Act
    const next = addCameraReducer(verified, action)

    // Assert
    expect(next.form).toMatchObject({ port: 34567, streamPath: null, streamProtocol: 'dvrip' })
    expect(next.verification).toBeNull()
  })

  it('addCameraReducer_ShouldRestoreTheStream_WhenTheFallbackIsTurnedOff', () => {
    // Arrange
    const dvrip = addCameraReducer(verified, {
      type: 'DVRIP_MODE_TOGGLED',
      enabled: true,
      fallbackPort: 554,
      fallbackStreamPath: '/stream1',
    })

    // Act
    const next = addCameraReducer(dvrip, {
      type: 'DVRIP_MODE_TOGGLED',
      enabled: false,
      fallbackPort: 554,
      fallbackStreamPath: '/stream1',
    })

    // Assert
    expect(next.form).toMatchObject({ port: 554, streamPath: '/stream1', streamProtocol: 'rtsp' })
  })

  it('addCameraReducer_ShouldSayWhyAndKeepNoVerification_WhenTheStreamDoesNotAnswer', () => {
    // Arrange
    const action = {
      type: 'VERIFY_DRAFT_SUCCEEDED',
      connected: false,
      guidance: null,
      message: 'Le flux ne répond pas.',
    } as const

    // Act
    const next = addCameraReducer(verified, action)

    // Assert
    expect(next.verification).toBeNull()
    expect(next.error).toEqual({ message: 'Le flux ne répond pas.' })
  })
})
