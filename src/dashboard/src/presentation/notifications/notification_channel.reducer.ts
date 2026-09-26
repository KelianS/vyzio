import type { NotificationChannelAction } from './notification_channel.actions'
import type { NotificationChannelUido } from './notification_channel.uido'

export function notificationChannelReducer(
  state: NotificationChannelUido,
  action: NotificationChannelAction,
): NotificationChannelUido {
  switch (action.type) {
    case 'CONFIG_STARTED':
      return { ...state, configLoading: true }
    case 'CONFIG_LOADED':
      return { ...state, configLoading: false, config: action.config }
    case 'LABELS_LOADED':
      return { ...state, labelsLoading: false, labels: action.labels }

    case 'SAVE_STARTED':
      return { ...state, saving: true }
    case 'SAVE_FINISHED':
      return { ...state, saving: false }
    case 'ENABLE_ASKED':
      return { ...state, confirmEnable: true }
    case 'ENABLE_CLOSED':
      return { ...state, confirmEnable: false }
    case 'TEST_STARTED':
      return { ...state, testing: true }
    case 'TEST_FINISHED':
      return { ...state, testing: false }
    case 'REMOVE_ASKED':
      return { ...state, confirmRemove: true }
    case 'REMOVE_CANCELLED':
      return { ...state, confirmRemove: false }
    case 'REMOVE_STARTED':
      return { ...state, removing: true }
    // Success or failure, the question has been answered.
    case 'REMOVE_FINISHED':
      return { ...state, removing: false, confirmRemove: false }

    // A reload keeps what is shown until the answer comes.
    case 'PAIRING_STARTED':
      return { ...state, pairingLoading: true }
    case 'PAIRING_LOADED':
      return { ...state, pairingLoading: false, pairing: action.pairing }
    case 'LISTENING_STARTED':
      return { ...state, listeningLoading: true }
    case 'LISTENING_LOADED':
      return { ...state, listeningLoading: false, listening: action.listening }
    case 'START_PAIRING_STARTED':
      return { ...state, startingPairing: true }
    case 'START_PAIRING_FINISHED':
      return { ...state, startingPairing: false }
    case 'REVOKE_ASKED':
      return { ...state, confirmRevoke: true }
    // Also sent once the link is cut; a failed cut keeps the question open.
    case 'REVOKE_CANCELLED':
      return { ...state, confirmRevoke: false }
    case 'REVOKE_STARTED':
      return { ...state, revoking: true }
    case 'REVOKE_FINISHED':
      return { ...state, revoking: false }

    case 'LOG_STARTED':
      return { ...state, logLoading: true }
    case 'LOG_LOADED':
      return { ...state, logLoading: false, log: action.log }
    case 'JOURNAL_STARTED':
      return { ...state, journalLoading: true }
    case 'JOURNAL_LOADED':
      return { ...state, journalLoading: false, journal: action.journal }
  }
}
