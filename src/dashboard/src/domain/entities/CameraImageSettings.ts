export type IrCutMode = 'auto' | 'on' | 'off'

// Live snapshot read from/written to the camera (ADR-27) — never persisted by Vyzio.
export interface CameraImageSettings {
  brightness: number
  contrast: number
  saturation: number
  sharpness: number
  irCutMode: IrCutMode
}
