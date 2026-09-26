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
  labels: DetectionLabel[]
  labelsLoading: boolean
  saving: boolean
  /** Enabling sends images off the local network: asked once, at save. */
  confirmEnable: boolean
  testing: boolean
  confirmRemove: boolean
  removing: boolean

  pairing: ChannelPairing | null
  pairingLoading: boolean
  listening: ChannelListening | null
  listeningLoading: boolean
  startingPairing: boolean
  confirmRevoke: boolean
  revoking: boolean

  log: NotificationLogEntry[]
  logLoading: boolean
  journal: CommandJournalEntry[]
  journalLoading: boolean
}

export function buildInitialNotificationChannelUido(): NotificationChannelUido {
  return {
    config: null,
    configLoading: true,
    labels: [],
    labelsLoading: true,
    saving: false,
    confirmEnable: false,
    testing: false,
    confirmRemove: false,
    removing: false,

    pairing: null,
    pairingLoading: true,
    listening: null,
    listeningLoading: true,
    startingPairing: false,
    confirmRevoke: false,
    revoking: false,

    log: [],
    logLoading: true,
    journal: [],
    journalLoading: true,
  }
}
