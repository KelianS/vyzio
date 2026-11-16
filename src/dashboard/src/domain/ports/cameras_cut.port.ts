import type { CamerasCut } from '../entities/cameras_cut.entity'
import type { ChosenEnd } from '../entities/chosen_end.entity'

export interface CamerasCutRepository {
  getCamerasCut(): Promise<CamerasCut>
  /** Every camera, until the end or until resumed; the camera list says the result. */
  cutCameras(end: ChosenEnd): Promise<void>
}
