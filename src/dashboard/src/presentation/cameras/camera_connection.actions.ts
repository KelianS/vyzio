import type { AppError } from '../../common/errors/app_error'
import type {
  CameraCapabilityBinding,
  Capability,
  StreamProtocol,
  SupportedProtocol,
} from '../../domain/entities/camera_capability_binding.entity'
import type { CameraProtocol } from '../../domain/entities/camera_protocol.entity'
import type {
  AvailableStream,
  CameraStreamLineup,
} from '../../domain/entities/camera_stream.entity'
import type { CapabilityTask, StreamTask } from './camera_connection.uido'

export type CameraConnectionAction =
  | { type: 'SAVE_STARTED' }
  | { type: 'SAVE_FINISHED' }
  | { type: 'VERIFY_STARTED' }
  | { type: 'VERIFY_FINISHED' }
  | { type: 'DELETE_ASKED' }
  | { type: 'DELETE_CANCELLED' }
  | { type: 'DELETE_STARTED' }
  | { type: 'DELETE_FINISHED' }
  | { type: 'BINDINGS_STARTED' }
  | { type: 'BINDINGS_LOADED'; bindings: CameraCapabilityBinding[] }
  | { type: 'BINDINGS_FAILED'; error: AppError }
  | { type: 'CAMERA_GONE' }
  | { type: 'DETECT_STARTED' }
  | { type: 'DETECT_FINISHED' }
  | { type: 'DETECT_SUCCEEDED' }
  | { type: 'TASK_STARTED'; capability: Capability; task: CapabilityTask }
  | { type: 'TASK_FINISHED'; capability: Capability }
  | { type: 'QUESTION_ASKED'; capability: Capability }
  | { type: 'QUESTION_CLOSED'; capability: Capability }
  | { type: 'MANUAL_OPENED' }
  | { type: 'MANUAL_CLOSED' }
  | { type: 'MANUAL_STARTED' }
  | { type: 'MANUAL_FINISHED' }
  | { type: 'PROTOCOLS_STARTED' }
  | { type: 'PROTOCOLS_LOADED'; protocols: CameraProtocol[] }
  | { type: 'PROTOCOLS_FAILED'; error: AppError }
  | { type: 'PROTOCOL_CHECK_STARTED'; protocol: SupportedProtocol }
  | { type: 'PROTOCOL_CHECKED'; protocol: CameraProtocol }
  | { type: 'PROTOCOL_CHECK_FINISHED'; protocol: SupportedProtocol }
  | { type: 'PROTOCOL_SEARCH_STARTED' }
  | { type: 'PROTOCOL_SEARCH_FINISHED' }
  | { type: 'PROTOCOL_FORM_OPENED' }
  | { type: 'PROTOCOL_FORM_CLOSED' }
  | { type: 'PROTOCOL_ADD_STARTED' }
  | { type: 'PROTOCOL_ADD_FINISHED' }
  | { type: 'PROTOCOL_REMOVE_STARTED'; protocol: SupportedProtocol }
  | { type: 'PROTOCOL_REMOVE_FINISHED'; protocol: SupportedProtocol }
  | { type: 'STREAMS_STARTED' }
  | { type: 'STREAMS_LOADED'; streams: CameraStreamLineup }
  | { type: 'STREAMS_FAILED'; error: AppError }
  | { type: 'STREAM_TASK_STARTED'; streamId: string; task: StreamTask }
  | { type: 'STREAM_TASK_FINISHED'; streamId: string }
  | { type: 'STREAM_FORM_OPENED' }
  | { type: 'STREAM_FORM_CLOSED' }
  | { type: 'STREAM_ADD_STARTED' }
  | { type: 'STREAM_ADD_FINISHED' }
  | { type: 'STREAM_PATH_ASKED'; asked: boolean }
  | { type: 'AVAILABLE_STREAMS_STARTED'; protocol: StreamProtocol }
  | { type: 'AVAILABLE_STREAMS_LOADED'; protocol: StreamProtocol; streams: AvailableStream[] }
  | { type: 'AVAILABLE_STREAMS_FAILED'; protocol: StreamProtocol; error: AppError }
