import { CorrectDetectionIdentity } from '../../domain/usecases/CorrectDetectionIdentity'
import { GetDetectionHistory } from '../../domain/usecases/GetDetectionHistory'
import { GetDetectionLabels } from '../../domain/usecases/GetDetectionLabels'
import { GetProfiles } from '../../domain/usecases/GetProfiles'
import type { ProfileRepository } from '../../domain/ports/ProfileRepository'
import type { DetectionLabelsRepository } from '../../domain/usecases/GetDetectionLabels'

export interface DetectionHistoryContainer {
  getDetectionHistory: GetDetectionHistory
  correctDetectionIdentity: CorrectDetectionIdentity
  getCameraLabels: GetDetectionLabels
  getProfiles: GetProfiles
}

export function makeDetectionHistoryContainer(
  profileRepository: ProfileRepository,
  cameraLabelsRepository: DetectionLabelsRepository,
): DetectionHistoryContainer {
  return {
    getDetectionHistory: new GetDetectionHistory(profileRepository),
    correctDetectionIdentity: new CorrectDetectionIdentity(profileRepository),
    getCameraLabels: new GetDetectionLabels(cameraLabelsRepository),
    getProfiles: new GetProfiles(profileRepository),
  }
}
