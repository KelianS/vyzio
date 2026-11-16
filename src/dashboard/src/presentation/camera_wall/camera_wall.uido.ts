export interface CameraWallUido {
  /** The cameras whose cut or resume is on its way: their eye waits. */
  privacyBusyIds: string[]
}

export function buildInitialCameraWallUido(): CameraWallUido {
  return { privacyBusyIds: [] }
}
