import { DeleteNotificationChannel } from '../../domain/usecases/DeleteNotificationChannel'
import { GetChannelListening } from '../../domain/usecases/GetChannelListening'
import { GetChannelPairing } from '../../domain/usecases/GetChannelPairing'
import { GetCommandJournal } from '../../domain/usecases/GetCommandJournal'
import { GetDetectionLabels } from '../../domain/usecases/GetDetectionLabels'
import { GetNotificationChannelConfig } from '../../domain/usecases/GetNotificationChannelConfig'
import { GetNotificationLog } from '../../domain/usecases/GetNotificationLog'
import { ListNotificationChannels } from '../../domain/usecases/ListNotificationChannels'
import { RevokeChannelPairing } from '../../domain/usecases/RevokeChannelPairing'
import { SaveNotificationChannelConfig } from '../../domain/usecases/SaveNotificationChannelConfig'
import { StartChannelPairing } from '../../domain/usecases/StartChannelPairing'
import { TestNotificationChannel } from '../../domain/usecases/TestNotificationChannel'
import type { NotificationSettingsRepository } from '../../domain/ports/NotificationSettingsRepository'
import type { DetectionLabelsRepository } from '../../domain/usecases/GetDetectionLabels'

export interface NotificationsContainer {
  listNotificationChannels: ListNotificationChannels
  getNotificationChannelConfig: GetNotificationChannelConfig
  saveNotificationChannelConfig: SaveNotificationChannelConfig
  testNotificationChannel: TestNotificationChannel
  deleteNotificationChannel: DeleteNotificationChannel
  getNotificationLog: GetNotificationLog
  getNotificationLabels: GetDetectionLabels
  getChannelPairing: GetChannelPairing
  getChannelListening: GetChannelListening
  getCommandJournal: GetCommandJournal
  startChannelPairing: StartChannelPairing
  revokeChannelPairing: RevokeChannelPairing
}

export function makeNotificationsContainer(
  notificationSettingsRepository: NotificationSettingsRepository,
  notificationLabelsRepository: DetectionLabelsRepository,
): NotificationsContainer {
  return {
    listNotificationChannels: new ListNotificationChannels(notificationSettingsRepository),
    getNotificationChannelConfig: new GetNotificationChannelConfig(notificationSettingsRepository),
    saveNotificationChannelConfig: new SaveNotificationChannelConfig(
      notificationSettingsRepository,
    ),
    testNotificationChannel: new TestNotificationChannel(notificationSettingsRepository),
    deleteNotificationChannel: new DeleteNotificationChannel(notificationSettingsRepository),
    getNotificationLog: new GetNotificationLog(notificationSettingsRepository),
    getNotificationLabels: new GetDetectionLabels(notificationLabelsRepository),
    getChannelPairing: new GetChannelPairing(notificationSettingsRepository),
    getChannelListening: new GetChannelListening(notificationSettingsRepository),
    getCommandJournal: new GetCommandJournal(notificationSettingsRepository),
    startChannelPairing: new StartChannelPairing(notificationSettingsRepository),
    revokeChannelPairing: new RevokeChannelPairing(notificationSettingsRepository),
  }
}
