import type { Camera } from '../../domain/entities/camera.entity'
import type { CameraUpdateInput } from '../../domain/entities/camera_input.entity'

/** The whole camera as an update expects it, with the fields a screen edits laid over. */
export function cameraUpdate(
  camera: Camera,
  edited: Partial<CameraUpdateInput>,
): CameraUpdateInput {
  return {
    displayName: camera.displayName,
    host: camera.host,
    username: camera.username ?? null,
    // A null password keeps the saved one.
    password: null,
    vendorFamily: camera.vendorFamily,
    sourceType: camera.sourceType,
    ptzSupported: camera.ptzSupported,
    ...edited,
  }
}
