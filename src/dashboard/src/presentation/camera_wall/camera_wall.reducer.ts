import type { CameraWallAction } from './camera_wall.actions'
import type { CameraWallUido } from './camera_wall.uido'

export function cameraWallReducer(state: CameraWallUido, action: CameraWallAction): CameraWallUido {
  switch (action.type) {
    case 'PRIVACY_STARTED':
      return { privacyBusyIds: [...state.privacyBusyIds, ...action.cameraIds] }
    case 'PRIVACY_FINISHED':
      return {
        privacyBusyIds: state.privacyBusyIds.filter((id) => !action.cameraIds.includes(id)),
      }
  }
}
