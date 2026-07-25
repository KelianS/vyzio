import { getDashboardRuntime } from '../config/runtime'
import { HttpCameraRepository } from '../repositories/HttpCameraRepository'
import {
  HttpCameraLabelsRepository,
  HttpNotificationLabelsRepository,
} from '../repositories/HttpDetectionLabelsRepository'
import { HttpHubRepository } from '../repositories/HttpHubRepository'
import { HttpNotificationSettingsRepository } from '../repositories/HttpNotificationSettingsRepository'
import { HttpProfileRepository } from '../repositories/HttpProfileRepository'
import { HttpSystemRepository } from '../repositories/HttpSystemRepository'
import { makeCamerasContainer, type CamerasContainer } from './cameras.container'
import {
  makeDetectionHistoryContainer,
  type DetectionHistoryContainer,
} from './detectionHistory.container'
import { makeHubContainer, type HubContainer } from './hub.container'
import { makeNotificationsContainer, type NotificationsContainer } from './notifications.container'
import { makeProfilesContainer, type ProfilesContainer } from './profiles.container'

export interface AppContainer {
  apiBaseUrl: string
  frigateBaseUrl: string
  hub: HubContainer
  cameras: CamerasContainer
  profiles: ProfilesContainer
  notifications: NotificationsContainer
  detectionHistory: DetectionHistoryContainer
}

export function makeAppContainer(): AppContainer {
  const runtime = getDashboardRuntime()

  const hubRepository = new HttpHubRepository(runtime.apiBaseUrl)
  const systemRepository = new HttpSystemRepository(runtime.apiBaseUrl)
  const cameraRepository = new HttpCameraRepository(runtime.apiBaseUrl)
  const profileRepository = new HttpProfileRepository(runtime.apiBaseUrl)
  const notificationSettingsRepository = new HttpNotificationSettingsRepository(runtime.apiBaseUrl)
  const cameraLabelsRepository = new HttpCameraLabelsRepository(runtime.apiBaseUrl)
  const notificationLabelsRepository = new HttpNotificationLabelsRepository(runtime.apiBaseUrl)

  return {
    apiBaseUrl: runtime.apiBaseUrl,
    frigateBaseUrl: runtime.frigateBaseUrl,
    hub: makeHubContainer(hubRepository, systemRepository),
    cameras: makeCamerasContainer(cameraRepository, profileRepository, cameraLabelsRepository),
    profiles: makeProfilesContainer(profileRepository),
    notifications: makeNotificationsContainer(
      notificationSettingsRepository,
      notificationLabelsRepository,
    ),
    detectionHistory: makeDetectionHistoryContainer(profileRepository, cameraLabelsRepository),
  }
}

/** Composition root — built once for the whole app lifetime. */
export const appContainer = makeAppContainer()
