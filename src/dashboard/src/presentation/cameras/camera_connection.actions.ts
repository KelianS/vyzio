import type { AppError } from '../../common/errors/app_error'
import type {
  CameraCapabilityBinding,
  Capability,
  SupportedProtocol,
} from '../../domain/entities/camera_capability_binding.entity'
import type { CameraProtocol } from '../../domain/entities/camera_protocol.entity'
import type { CapabilityTask } from './camera_connection.uido'

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
  | { type: 'TASK_STARTED'; capability: Capability; task: CapabilityTask }
  | { type: 'TASK_FINISHED'; capability: Capability }
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
