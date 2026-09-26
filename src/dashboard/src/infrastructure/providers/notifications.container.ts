import { DeleteNotificationChannel } from '../../domain/usecases/delete_notification_channel.use_case'
import { GetChannelListening } from '../../domain/usecases/get_channel_listening.use_case'
import { GetChannelPairing } from '../../domain/usecases/get_channel_pairing.use_case'
import { GetCommandJournal } from '../../domain/usecases/get_command_journal.use_case'
import { GetDetectionLabels } from '../../domain/usecases/get_detection_labels.use_case'
import { GetNotificationChannelConfig } from '../../domain/usecases/get_notification_channel_config.use_case'
import { GetNotificationLog } from '../../domain/usecases/get_notification_log.use_case'
import { ListNotificationChannels } from '../../domain/usecases/list_notification_channels.use_case'
import { RevokeChannelPairing } from '../../domain/usecases/revoke_channel_pairing.use_case'
import { SaveNotificationChannelConfig } from '../../domain/usecases/save_notification_channel_config.use_case'
import { StartChannelPairing } from '../../domain/usecases/start_channel_pairing.use_case'
import { TestNotificationChannel } from '../../domain/usecases/test_notification_channel.use_case'
import type { NotificationSettingsRepository } from '../../domain/ports/notification_settings.port'
import type { DetectionLabelsRepository } from '../../domain/usecases/get_detection_labels.use_case'

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
