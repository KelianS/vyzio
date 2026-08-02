import { CorrectDetectionIdentity } from '../../domain/usecases/CorrectDetectionIdentity'
import { GetDetectionHistory } from '../../domain/usecases/GetDetectionHistory'
import { GetDetectionLabels } from '../../domain/usecases/GetDetectionLabels'
import { GetProfiles } from '../../domain/usecases/GetProfiles'
import { GetRecordingSettings } from '../../domain/usecases/GetRecordingSettings'
import { SaveRecordingSettings } from '../../domain/usecases/SaveRecordingSettings'
import type { ProfileRepository } from '../../domain/ports/ProfileRepository'
import type { RecordingSettingsRepository } from '../../domain/ports/RecordingSettingsRepository'
import type { DetectionLabelsRepository } from '../../domain/usecases/GetDetectionLabels'

export interface DetectionHistoryContainer {
  getDetectionHistory: GetDetectionHistory
  correctDetectionIdentity: CorrectDetectionIdentity
  getCameraLabels: GetDetectionLabels
  getProfiles: GetProfiles
  // Retention sits with the history because that is where the user thinks about how long things
  // are kept — SPECS §6 groups history, storage and retention together.
  getRecordingSettings: GetRecordingSettings
  saveRecordingSettings: SaveRecordingSettings
}

export function makeDetectionHistoryContainer(
  profileRepository: ProfileRepository,
  cameraLabelsRepository: DetectionLabelsRepository,
  recordingSettingsRepository: RecordingSettingsRepository,
): DetectionHistoryContainer {
  return {
    getDetectionHistory: new GetDetectionHistory(profileRepository),
    correctDetectionIdentity: new CorrectDetectionIdentity(profileRepository),
    getCameraLabels: new GetDetectionLabels(cameraLabelsRepository),
    getProfiles: new GetProfiles(profileRepository),
    getRecordingSettings: new GetRecordingSettings(recordingSettingsRepository),
    saveRecordingSettings: new SaveRecordingSettings(recordingSettingsRepository),
  }
}
