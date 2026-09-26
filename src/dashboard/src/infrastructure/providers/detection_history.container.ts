import { CorrectDetectionIdentity } from '../../domain/usecases/correct_detection_identity.use_case'
import { GetDetectionHistory } from '../../domain/usecases/get_detection_history.use_case'
import { GetDetectionLabels } from '../../domain/usecases/get_detection_labels.use_case'
import { GetProfiles } from '../../domain/usecases/get_profiles.use_case'
import type { ProfileRepository } from '../../domain/ports/profile.port'
import type { DetectionLabelsRepository } from '../../domain/usecases/get_detection_labels.use_case'

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
