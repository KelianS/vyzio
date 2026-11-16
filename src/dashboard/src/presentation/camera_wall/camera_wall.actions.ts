export type CameraWallAction =
  | { type: 'PRIVACY_STARTED'; cameraIds: readonly string[] }
  | { type: 'PRIVACY_FINISHED'; cameraIds: readonly string[] }
