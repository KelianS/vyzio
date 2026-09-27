import type { AppError } from '../../common/errors/app_error'
import type { DetectionLabel } from '../../domain/entities/detection_label.entity'
import type {
  ChannelListening,
  ChannelPairing,
  CommandJournalEntry,
  NotificationChannelConfig,
  NotificationLogEntry,
} from '../../domain/entities/notification_channel_config.entity'

export interface NotificationChannelUido {
  config: NotificationChannelConfig | null
  configLoading: boolean
  configError: AppError | null
  labels: DetectionLabel[]
  labelsLoading: boolean
  labelsError: AppError | null
  saving: boolean
  /** Enabling sends images off the local network: asked once, at save. */
  confirmEnable: boolean
  testing: boolean
  confirmRemove: boolean
  removing: boolean

  pairing: ChannelPairing | null
  pairingLoading: boolean
  pairingError: AppError | null
  listening: ChannelListening | null
  listeningLoading: boolean
  listeningError: AppError | null
  startingPairing: boolean
  confirmRevoke: boolean
  revoking: boolean

  log: NotificationLogEntry[]
  logLoading: boolean
  logError: AppError | null
  journal: CommandJournalEntry[]
  journalLoading: boolean
  journalError: AppError | null
}

export function buildInitialNotificationChannelUido(): NotificationChannelUido {
  return {
    config: null,
    configLoading: true,
    configError: null,
    labels: [],
    labelsLoading: true,
    labelsError: null,
    saving: false,
    confirmEnable: false,
    testing: false,
    confirmRemove: false,
    removing: false,

    pairing: null,
    pairingLoading: true,
    pairingError: null,
    listening: null,
    listeningLoading: true,
    listeningError: null,
    startingPairing: false,
    confirmRevoke: false,
    revoking: false,

    log: [],
    logLoading: true,
    logError: null,
    journal: [],
    journalLoading: true,
    journalError: null,
  }
}
