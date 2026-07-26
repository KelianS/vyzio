import { DeleteNotificationChannel } from '../../domain/usecases/DeleteNotificationChannel'
import { GetDetectionLabels } from '../../domain/usecases/GetDetectionLabels'
import { GetNotificationChannelConfig } from '../../domain/usecases/GetNotificationChannelConfig'
import { GetNotificationLog } from '../../domain/usecases/GetNotificationLog'
import { SaveNotificationChannelConfig } from '../../domain/usecases/SaveNotificationChannelConfig'
import { TestNotificationChannel } from '../../domain/usecases/TestNotificationChannel'
import type { NotificationSettingsRepository } from '../../domain/ports/NotificationSettingsRepository'
import type { DetectionLabelsRepository } from '../../domain/usecases/GetDetectionLabels'

export interface NotificationsContainer {
  getNotificationChannelConfig: GetNotificationChannelConfig
  saveNotificationChannelConfig: SaveNotificationChannelConfig
  testNotificationChannel: TestNotificationChannel
  deleteNotificationChannel: DeleteNotificationChannel
  getNotificationLog: GetNotificationLog
  getNotificationLabels: GetDetectionLabels
}

export function makeNotificationsContainer(
  notificationSettingsRepository: NotificationSettingsRepository,
  notificationLabelsRepository: DetectionLabelsRepository,
): NotificationsContainer {
  return {
    getNotificationChannelConfig: new GetNotificationChannelConfig(notificationSettingsRepository),
    saveNotificationChannelConfig: new SaveNotificationChannelConfig(
      notificationSettingsRepository,
    ),
    testNotificationChannel: new TestNotificationChannel(notificationSettingsRepository),
    deleteNotificationChannel: new DeleteNotificationChannel(notificationSettingsRepository),
    getNotificationLog: new GetNotificationLog(notificationSettingsRepository),
    getNotificationLabels: new GetDetectionLabels(notificationLabelsRepository),
  }
}
