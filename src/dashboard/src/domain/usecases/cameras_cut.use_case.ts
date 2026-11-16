import type { CamerasCut } from '../entities/cameras_cut.entity'
import type { ChosenEnd } from '../entities/chosen_end.entity'
import type { CamerasCutRepository } from '../ports/cameras_cut.port'

export class GetCamerasCut {
  constructor(private readonly repository: CamerasCutRepository) {}

  execute(): Promise<CamerasCut> {
    return this.repository.getCamerasCut()
  }
}

/** Replaces the end of a cut already running. */
export class CutCameras {
  constructor(private readonly repository: CamerasCutRepository) {}

  execute(end: ChosenEnd): Promise<void> {
    return this.repository.cutCameras(end)
  }
}
