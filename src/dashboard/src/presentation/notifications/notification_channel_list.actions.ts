import type { AppError } from '../../common/errors/app_error'
import type { NotificationChannelSummary } from '../../domain/entities/notification_channel_config.entity'

export type NotificationChannelListAction =
  | { type: 'LOAD_STARTED' }
  | { type: 'LOAD_SUCCEEDED'; channels: NotificationChannelSummary[] }
  | { type: 'LOAD_FAILED'; error: AppError }
