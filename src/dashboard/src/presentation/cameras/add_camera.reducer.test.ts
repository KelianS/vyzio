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

const manual = {
  ...buildInitialAddCameraUido(),
  selection: { kind: 'manual' as const },
  form: { displayName: '', host: '', username: 'user', password: 'secret' },
}

describe('addCameraReducer', () => {
  it('addCameraReducer_ShouldTakeOnlyTheNameAndAddressAndKeepTheCredentials_WhenACandidateIsChosen', () => {
    // Arrange
    const action = { type: 'CANDIDATE_SELECTED', index: 0, candidate } as const

    // Act
    const next = addCameraReducer(manual, action)

    // Assert
    expect(next.form).toEqual({
      displayName: 'Garage',
      host: '192.168.1.40',
      username: 'user',
      password: 'secret',
    })
    expect(next.selection).toEqual({ kind: 'candidate', index: 0 })
  })

  it('addCameraReducer_ShouldStartFromAnEmptyAccess_WhenTheUserTypesTheAddress', () => {
    // Arrange
    const chosen = { ...manual, selection: { kind: 'candidate' as const, index: 0 } }

    // Act
    const next = addCameraReducer(chosen, { type: 'MANUAL_ENTRY_SELECTED' })

    // Assert
    expect(next.form).toEqual({ displayName: '', host: '', username: null, password: null })
    expect(next.selection).toEqual({ kind: 'manual' })
  })

  it('addCameraReducer_ShouldKeepTheFailureAndItsDiagnostic_WhenTheCameraCannotBeCreated', () => {
    // Arrange
    const creating = { ...manual, creating: true }
    const action = {
      type: 'CREATE_FAILED',
      message: 'Ces informations ne sont pas valides.',
      diagnostic: 'POST /api/cameras · 400',
    } as const

    // Act
    const next = addCameraReducer(creating, action)

    // Assert
    expect(next.creating).toBe(false)
    expect(next.error).toEqual({
      message: 'Ces informations ne sont pas valides.',
      diagnostic: 'POST /api/cameras · 400',
    })
  })
})
