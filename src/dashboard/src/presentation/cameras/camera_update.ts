import type { Camera } from '../../domain/entities/camera.entity'
import type { CameraDraftInput } from '../../domain/entities/camera_draft_input.entity'

/** The whole camera as an update expects it, with the fields a screen edits laid over. */
export function cameraUpdate(camera: Camera, edited: Partial<CameraDraftInput>): CameraDraftInput {
  return {
    displayName: camera.displayName,
    host: camera.host,
    port: camera.port,
    username: camera.username ?? null,
    // A null password keeps the saved one.
    password: null,
    streamPath: camera.streamPath ?? null,
    vendorFamily: camera.vendorFamily,
    sourceType: camera.sourceType,
    streamProtocol: camera.streamProtocol,
    ptzSupported: camera.ptzSupported,
    ...edited,
  }
}
