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
  stream: { protocol: 'rtsp', port: 554, path: '/stream1' },
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
      streamProtocol: 'rtsp',
      username: 'user',
      password: 'secret',
    })
    expect(next.selection).toEqual({ kind: 'candidate', index: 0 })
  })

  it('addCameraReducer_ShouldStartFromTheDvripStream_WhenTheCandidateIsReadyOverDvrip', () => {
    // Arrange
    const overDvrip: DiscoveredCamera = {
      ...candidate,
      streamPath: null,
      rtspActive: false,
      stream: { protocol: 'dvrip', port: 34567, path: null },
    }

    // Act
    const next = addCameraReducer(verified, {
      type: 'CANDIDATE_SELECTED',
      index: 0,
      candidate: overDvrip,
    })

    // Assert
    expect(next.form).toMatchObject({ port: 34567, streamPath: null, streamProtocol: 'dvrip' })
  })

  it('addCameraReducer_ShouldStartFromRtsp_WhenNoProtocolServesTheCandidateStreamYet', () => {
    // Arrange
    const toPrepare: DiscoveredCamera = { ...candidate, streamPath: null, stream: null }

    // Act
    const next = addCameraReducer(verified, {
      type: 'CANDIDATE_SELECTED',
      index: 0,
      candidate: toPrepare,
    })

    // Assert
    expect(next.form).toMatchObject({ port: 554, streamPath: null, streamProtocol: 'rtsp' })
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
