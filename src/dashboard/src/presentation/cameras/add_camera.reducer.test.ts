import { describe, expect, it } from 'vitest'
import {
  DiscoveryRangeSource,
  type DiscoveredCamera,
} from '../../domain/entities/discovered_camera.entity'
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
  qualification: 'camera_confirmed',
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

  it('addCameraReducer_ShouldPreselectTheHelpVendor_WhenDiscoveryRecognisedTheChosenCamera', () => {
    // Arrange
    const action = { type: 'CANDIDATE_SELECTED', index: 0, candidate } as const

    // Act
    const next = addCameraReducer(manual, action)

    // Assert
    expect(next.helpVendor).toBe('tplink_tapo')
  })

  it('addCameraReducer_ShouldClearTheHelpVendor_WhenTheUserTypesTheAddress', () => {
    // Arrange
    const helped = { ...manual, helpVendor: 'icsee' }

    // Act
    const next = addCameraReducer(helped, { type: 'MANUAL_ENTRY_SELECTED' })

    // Assert
    expect(next.helpVendor).toBeNull()
  })

  it('addCameraReducer_ShouldKeepTheUsersHelpVendor_WhenARetriedScanRecognisesNoVendor', () => {
    // Arrange
    const toPrepare = {
      ...manual,
      selection: { kind: 'candidate' as const, index: 0 },
      discoveryResults: [{ ...candidate, vendorFamily: null, stream: null }],
      helpVendor: 'v380_pro',
    }
    const action = {
      type: 'REFRESH_CANDIDATE_SUCCEEDED',
      index: 0,
      candidate: { ...candidate, vendorFamily: null },
      message: 'La caméra est maintenant joignable.',
    } as const

    // Act
    const next = addCameraReducer(toPrepare, action)

    // Assert
    expect(next.helpVendor).toBe('v380_pro')
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

  it('addCameraReducer_ShouldForgetThePreviousRanges_WhenANewSearchStarts', () => {
    // Arrange
    const searched = {
      ...buildInitialAddCameraUido(),
      sweptRanges: [
        {
          cidr: '192.168.1.0/24',
          firstAddress: '192.168.1.1',
          lastAddress: '192.168.1.254',
          source: DiscoveryRangeSource.DashboardAddress,
        },
      ],
    }

    // Act
    const next = addCameraReducer(searched, { type: 'DISCOVERY_STARTED' })

    // Assert
    expect(next.sweptRanges).toBeNull()
  })
})
