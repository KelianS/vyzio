import type { NotificationChannelAction } from './notification_channel.actions'
import {
  buildInitialNotificationChannelUido,
  type NotificationChannelUido,
} from './notification_channel.uido'

export function notificationChannelReducer(
  state: NotificationChannelUido,
  action: NotificationChannelAction,
): NotificationChannelUido {
  switch (action.type) {
    // Nothing read for another channel may stay on screen for this one.
    case 'CHANNEL_OPENED':
      return buildInitialNotificationChannelUido()
    case 'CONFIG_STARTED':
      return { ...state, configLoading: true, configError: null }
    case 'CONFIG_LOADED':
      return { ...state, configLoading: false, config: action.config }
    case 'CONFIG_FAILED':
      return { ...state, configLoading: false, config: null, configError: action.error }
    // A reread after a save or a test keeps the settings shown; the failure goes to a toast.
    case 'CONFIG_REFRESH_FAILED':
      return { ...state, configLoading: false }
    case 'LABELS_STARTED':
      return { ...state, labelsLoading: true, labelsError: null }
    case 'LABELS_LOADED':
      return { ...state, labelsLoading: false, labels: action.labels }
    case 'LABELS_FAILED':
      return { ...state, labelsLoading: false, labels: [], labelsError: action.error }

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
      return { ...state, pairingLoading: true, pairingError: null }
    case 'PAIRING_LOADED':
      return { ...state, pairingLoading: false, pairing: action.pairing }
    case 'PAIRING_FAILED':
      return { ...state, pairingLoading: false, pairing: null, pairingError: action.error }
    case 'PAIRING_REFRESH_FAILED':
      return { ...state, pairingLoading: false }
    case 'LISTENING_STARTED':
      return { ...state, listeningLoading: true, listeningError: null }
    case 'LISTENING_LOADED':
      return { ...state, listeningLoading: false, listening: action.listening }
    case 'LISTENING_FAILED':
      return {
        ...state,
        listeningLoading: false,
        listening: null,
        listeningError: action.error,
      }
    case 'LISTENING_REFRESH_FAILED':
      return { ...state, listeningLoading: false }
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
      return { ...state, logLoading: true, logError: null }
    case 'LOG_LOADED':
      return { ...state, logLoading: false, log: action.log }
    case 'LOG_FAILED':
      return { ...state, logLoading: false, log: [], logError: action.error }
    case 'LOG_REFRESH_FAILED':
      return { ...state, logLoading: false }
    case 'JOURNAL_STARTED':
      return { ...state, journalLoading: true, journalError: null }
    case 'JOURNAL_LOADED':
      return { ...state, journalLoading: false, journal: action.journal }
    case 'JOURNAL_FAILED':
      return { ...state, journalLoading: false, journal: [], journalError: action.error }
    case 'JOURNAL_REFRESH_FAILED':
      return { ...state, journalLoading: false }
  }
}
