import { describe, expect, it } from 'vitest'
import { AppErrorKind, type AppError } from '../../common/errors/app_error'
import { makeCapabilityBinding } from '../../testing/capability_binding_fixture'
import { makeCameraProtocol } from '../../testing/camera_protocol_fixture'
import {
  makeAvailableStream,
  makeCameraStream,
  makeStreamLineup,
} from '../../testing/camera_stream_fixture'
import { cameraConnectionReducer } from './camera_connection.reducer'
import {
  buildInitialCameraConnectionUido,
  CapabilityTask,
  StreamTask,
} from './camera_connection.uido'

const readError: AppError = { kind: AppErrorKind.Server, status: 500 }

describe('cameraConnectionReducer', () => {
  it('cameraConnectionReducer_ShouldFreeOnlyThatCapability_WhenItsTaskFinishes', () => {
    // Arrange
    const state = {
      ...buildInitialCameraConnectionUido(),
      pending: { ptz: CapabilityTask.TogglePtz, image_settings: CapabilityTask.Remove },
    }

    // Act
    const next = cameraConnectionReducer(state, { type: 'TASK_FINISHED', capability: 'ptz' })

    // Assert
    expect(next.pending).toEqual({ image_settings: CapabilityTask.Remove })
  })

  it('cameraConnectionReducer_ShouldForgetTheLastAnswer_WhenTheCameraIsAskedForItsStreamsAgain', () => {
    // Arrange
    const state = {
      ...buildInitialCameraConnectionUido(),
      availableStreams: { rtsp: [makeAvailableStream()], dvrip: [] },
    }

    // Act
    const next = cameraConnectionReducer(state, {
      type: 'AVAILABLE_STREAMS_STARTED',
      protocol: 'rtsp',
    })

    // Assert
    expect(next.availableStreams).toEqual({ dvrip: [] })
  })

  it('cameraConnectionReducer_ShouldKeepTheFailureApartFromAnEmptyList_WhenTheRequestFails', () => {
    // Arrange
    const state = buildInitialCameraConnectionUido()

    // Act
    const next = cameraConnectionReducer(state, {
      type: 'AVAILABLE_STREAMS_FAILED',
      protocol: 'dvrip',
      error: readError,
    })

    // Assert
    expect(next.availableStreams).toEqual({ dvrip: [] })
    expect(next.availableStreamsErrors).toEqual({ dvrip: readError })
  })

  it('cameraConnectionReducer_ShouldCloseTheQuestion_WhenTheDeleteFinishes', () => {
    // Arrange
    const state = { ...buildInitialCameraConnectionUido(), confirmDelete: true, deleting: true }

    // Act
    const next = cameraConnectionReducer(state, { type: 'DELETE_FINISHED' })

    // Assert
    expect(next.confirmDelete).toBe(false)
    expect(next.deleting).toBe(false)
  })

  it('cameraConnectionReducer_ShouldOfferNoCapabilityAndKeepTheError_WhenTheReadFails', () => {
    // Arrange
    const state = cameraConnectionReducer(buildInitialCameraConnectionUido(), {
      type: 'BINDINGS_LOADED',
      bindings: [makeCapabilityBinding()],
    })

    // Act
    const next = cameraConnectionReducer(state, { type: 'BINDINGS_FAILED', error: readError })

    // Assert
    expect(next.bindings).toEqual([])
    expect(next.bindingsError).toEqual(readError)
    expect(next.bindingsLoading).toBe(false)
  })

  it('cameraConnectionReducer_ShouldClearTheFailure_WhenTheReadStartsAgain', () => {
    // Arrange
    const state = cameraConnectionReducer(buildInitialCameraConnectionUido(), {
      type: 'BINDINGS_FAILED',
      error: readError,
    })

    // Act
    const next = cameraConnectionReducer(state, { type: 'BINDINGS_STARTED' })

    // Assert
    expect(next.bindingsError).toBeNull()
  })

  it('cameraConnectionReducer_ShouldSayTheCameraIsGone_WhenItNoLongerExists', () => {
    // Arrange
    const state = buildInitialCameraConnectionUido()

    // Act
    const next = cameraConnectionReducer(state, { type: 'CAMERA_GONE' })

    // Assert
    expect(next.cameraGone).toBe(true)
    expect(next.bindingsLoading).toBe(false)
  })

  it('cameraConnectionReducer_ShouldReplaceOnlyTheCheckedBox_WhenAProtocolAnswers', () => {
    // Arrange
    const onvif = makeCameraProtocol({ protocol: 'onvif', status: null })
    const state = cameraConnectionReducer(buildInitialCameraConnectionUido(), {
      type: 'PROTOCOLS_LOADED',
      protocols: [makeCameraProtocol(), onvif],
    })
    const checked = makeCameraProtocol({ status: 'refused', lastError: 'RTSP: 401' })

    // Act
    const next = cameraConnectionReducer(state, { type: 'PROTOCOL_CHECKED', protocol: checked })

    // Assert
    expect(next.protocols).toEqual([checked, onvif])
  })

  it('cameraConnectionReducer_ShouldShowNoBoxAndKeepTheError_WhenTheProtocolsReadFails', () => {
    // Arrange
    const state = cameraConnectionReducer(buildInitialCameraConnectionUido(), {
      type: 'PROTOCOLS_LOADED',
      protocols: [makeCameraProtocol()],
    })

    // Act
    const next = cameraConnectionReducer(state, { type: 'PROTOCOLS_FAILED', error: readError })

    // Assert
    expect(next.protocols).toEqual([])
    expect(next.protocolsError).toBe(readError)
  })

  it('cameraConnectionReducer_ShouldFreeOnlyThatProtocol_WhenItsCheckFinishes', () => {
    // Arrange
    const state = {
      ...buildInitialCameraConnectionUido(),
      checking: { rtsp: true, v380: true } as const,
    }

    // Act
    const next = cameraConnectionReducer(state, {
      type: 'PROTOCOL_CHECK_FINISHED',
      protocol: 'rtsp',
    })

    // Assert
    expect(next.checking).toEqual({ v380: true })
  })

  it('cameraConnectionReducer_ShouldFreeOnlyThatProtocol_WhenItsRemovalFinishes', () => {
    // Arrange
    const state = {
      ...buildInitialCameraConnectionUido(),
      removing: { onvif: true, v380: true } as const,
    }

    // Act
    const next = cameraConnectionReducer(state, {
      type: 'PROTOCOL_REMOVE_FINISHED',
      protocol: 'onvif',
    })

    // Assert
    expect(next.removing).toEqual({ v380: true })
  })

  it('cameraConnectionReducer_ShouldShowNoLineAndKeepTheError_WhenTheStreamsReadFails', () => {
    // Arrange
    const state = cameraConnectionReducer(buildInitialCameraConnectionUido(), {
      type: 'STREAMS_LOADED',
      streams: makeStreamLineup([makeCameraStream()]),
    })

    // Act
    const next = cameraConnectionReducer(state, { type: 'STREAMS_FAILED', error: readError })

    // Assert
    expect(next.streams).toBeNull()
    expect(next.streamsError).toBe(readError)
  })

  it('cameraConnectionReducer_ShouldFreeOnlyThatStream_WhenItsTaskFinishes', () => {
    // Arrange
    const state = {
      ...buildInitialCameraConnectionUido(),
      streamTasks: { main: StreamTask.Check, sub: StreamTask.Remove },
    }

    // Act
    const next = cameraConnectionReducer(state, { type: 'STREAM_TASK_FINISHED', streamId: 'main' })

    // Assert
    expect(next.streamTasks).toEqual({ sub: StreamTask.Remove })
  })
})
