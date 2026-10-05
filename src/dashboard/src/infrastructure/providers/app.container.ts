import { getDashboardRuntime } from '../config/runtime'
import { HttpAccessRepository } from '../repositories/access.repository'
import { HttpCameraRepository } from '../repositories/camera.repository'
import { HttpCameraStreamRepository } from '../repositories/camera_stream.repository'
import {
  HttpCameraLabelsRepository,
  HttpNotificationLabelsRepository,
} from '../repositories/detection_labels.repository'
import { HttpHubRepository } from '../repositories/hub.repository'
import { HttpNotificationSettingsRepository } from '../repositories/notification_settings.repository'
import { HttpProfileRepository } from '../repositories/profile.repository'
import { HttpRecordingSettingsRepository } from '../repositories/recording_settings.repository'
import { HttpScheduleRepository } from '../repositories/schedule.repository'
import { HttpSystemRepository } from '../repositories/system.repository'
import { makeAccessContainer, type AccessContainer } from './access.container'
import { makeCamerasContainer, type CamerasContainer } from './cameras.container'
import { MseLiveStream } from '../live/mse_live_stream'
import {
  makeDetectionHistoryContainer,
  type DetectionHistoryContainer,
} from './detection_history.container'
import { makeHubContainer, type HubContainer } from './hub.container'
import { makeNotificationsContainer, type NotificationsContainer } from './notifications.container'
import { makeProfilesContainer, type ProfilesContainer } from './profiles.container'
import { makeSchedulesContainer, type SchedulesContainer } from './schedules.container'

export interface AppContainer {
  apiBaseUrl: string
  frigateBaseUrl: string
  access: AccessContainer
  hub: HubContainer
  cameras: CamerasContainer
  profiles: ProfilesContainer
  notifications: NotificationsContainer
  schedules: SchedulesContainer
  detectionHistory: DetectionHistoryContainer
}

function makeAppContainer(): AppContainer {
  const runtime = getDashboardRuntime()

  const accessRepository = new HttpAccessRepository(runtime.apiBaseUrl)
  const hubRepository = new HttpHubRepository(runtime.apiBaseUrl)
  const systemRepository = new HttpSystemRepository(runtime.apiBaseUrl)
  const cameraRepository = new HttpCameraRepository(runtime.apiBaseUrl)
  const profileRepository = new HttpProfileRepository(runtime.apiBaseUrl)
  const notificationSettingsRepository = new HttpNotificationSettingsRepository(runtime.apiBaseUrl)
  const cameraLabelsRepository = new HttpCameraLabelsRepository(runtime.apiBaseUrl)
  const notificationLabelsRepository = new HttpNotificationLabelsRepository(runtime.apiBaseUrl)
  const recordingSettingsRepository = new HttpRecordingSettingsRepository(runtime.apiBaseUrl)
  const scheduleRepository = new HttpScheduleRepository(runtime.apiBaseUrl)

  return {
    apiBaseUrl: runtime.apiBaseUrl,
    frigateBaseUrl: runtime.frigateBaseUrl,
    access: makeAccessContainer(accessRepository),
    hub: makeHubContainer(hubRepository, systemRepository),
    cameras: makeCamerasContainer(
      cameraRepository,
      profileRepository,
      cameraLabelsRepository,
      recordingSettingsRepository,
      new HttpCameraStreamRepository(runtime.apiBaseUrl),
      new MseLiveStream(runtime.apiBaseUrl),
    ),
    profiles: makeProfilesContainer(profileRepository),
    notifications: makeNotificationsContainer(
      notificationSettingsRepository,
      notificationLabelsRepository,
    ),
    schedules: makeSchedulesContainer(scheduleRepository),
    detectionHistory: makeDetectionHistoryContainer(profileRepository, cameraLabelsRepository),
  }
}

/** Composition root — built once for the whole app lifetime. */
export const appContainer = makeAppContainer()
