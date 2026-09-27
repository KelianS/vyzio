import type { ToastTone } from '../../common/components/toast'
import { toastError, type AppError } from '../../common/errors/app_error'
import { scrubSecrets } from '../../common/errors/scrub_secrets'
import { toAppError } from '../../common/errors/to_app_error'
import { latestOnly } from '../../common/presenter/latest_only'
import type {
  NotificationChannelConfig,
  NotificationChannelName,
} from '../../domain/entities/notification_channel_config.entity'
import type { NotificationsContainer } from '../../infrastructure/providers/notifications.container'
import type { NotificationChannelAction } from './notification_channel.actions'
import { toSaveRequest, type NotificationValues } from './notification_settings'

type OnFailure = (error: AppError) => void

export interface NotificationChannelPresenterContext {
  container: NotificationsContainer
  dispatch: (action: NotificationChannelAction) => void
  toast: (message: string, tone?: ToastTone, diagnostic?: string) => void
}

export function buildNotificationChannelPresenter({
  container,
  dispatch,
  toast,
}: NotificationChannelPresenterContext) {
  // Moving to another channel keeps the page mounted: only the latest read may answer.
  const nextConfigRead = latestOnly()
  const nextPairingRead = latestOnly()
  const nextListeningRead = latestOnly()
  const nextLabelsRead = latestOnly()
  const nextLogRead = latestOnly()
  const nextJournalRead = latestOnly()

  // A first read fails in place; a reread under data already shown keeps it and toasts.
  const keepShown =
    (stopped: NotificationChannelAction): OnFailure =>
    (error) => {
      dispatch(stopped)
      toastError(toast, error)
    }

  function readConfig(channel: NotificationChannelName, onFailure: OnFailure) {
    const isLatest = nextConfigRead()
    dispatch({ type: 'CONFIG_STARTED' })
    container.getNotificationChannelConfig
      .execute(channel)
      .then((config) => {
        if (isLatest()) dispatch({ type: 'CONFIG_LOADED', config })
      })
      .catch((e: unknown) => {
        if (isLatest()) onFailure(toAppError(e))
      })
  }

  function readLabels() {
    const isLatest = nextLabelsRead()
    dispatch({ type: 'LABELS_STARTED' })
    container.getNotificationLabels
      .execute()
      .then((labels) => {
        if (isLatest()) dispatch({ type: 'LABELS_LOADED', labels })
      })
      .catch((e: unknown) => {
        if (isLatest()) dispatch({ type: 'LABELS_FAILED', error: toAppError(e) })
      })
  }

  function readPairing(channel: NotificationChannelName, onFailure: OnFailure) {
    const isLatest = nextPairingRead()
    dispatch({ type: 'PAIRING_STARTED' })
    container.getChannelPairing
      .execute(channel)
      .then((pairing) => {
        if (isLatest()) dispatch({ type: 'PAIRING_LOADED', pairing })
      })
      .catch((e: unknown) => {
        if (isLatest()) onFailure(toAppError(e))
      })
  }

  function readListening(channel: NotificationChannelName, onFailure: OnFailure) {
    const isLatest = nextListeningRead()
    dispatch({ type: 'LISTENING_STARTED' })
    container.getChannelListening
      .execute(channel)
      .then((listening) => {
        if (isLatest()) dispatch({ type: 'LISTENING_LOADED', listening })
      })
      .catch((e: unknown) => {
        if (isLatest()) onFailure(toAppError(e))
      })
  }

  function readLog(channel: NotificationChannelName, onFailure: OnFailure) {
    const isLatest = nextLogRead()
    dispatch({ type: 'LOG_STARTED' })
    container.getNotificationLog
      .execute(channel)
      .then((log) => {
        if (isLatest()) dispatch({ type: 'LOG_LOADED', log })
      })
      .catch((e: unknown) => {
        if (isLatest()) onFailure(toAppError(e))
      })
  }

  function readJournal(channel: NotificationChannelName, onFailure: OnFailure) {
    const isLatest = nextJournalRead()
    dispatch({ type: 'JOURNAL_STARTED' })
    container.getCommandJournal
      .execute(channel)
      .then((journal) => {
        if (isLatest()) dispatch({ type: 'JOURNAL_LOADED', journal })
      })
      .catch((e: unknown) => {
        if (isLatest()) onFailure(toAppError(e))
      })
  }

  const configInPlace: OnFailure = (error) => dispatch({ type: 'CONFIG_FAILED', error })
  const configKept = keepShown({ type: 'CONFIG_REFRESH_FAILED' })
  const pairingInPlace: OnFailure = (error) => dispatch({ type: 'PAIRING_FAILED', error })
  const pairingKept = keepShown({ type: 'PAIRING_REFRESH_FAILED' })
  const listeningInPlace: OnFailure = (error) => dispatch({ type: 'LISTENING_FAILED', error })
  const listeningKept = keepShown({ type: 'LISTENING_REFRESH_FAILED' })
  const logInPlace: OnFailure = (error) => dispatch({ type: 'LOG_FAILED', error })
  const logKept = keepShown({ type: 'LOG_REFRESH_FAILED' })
  const journalInPlace: OnFailure = (error) => dispatch({ type: 'JOURNAL_FAILED', error })
  const journalKept = keepShown({ type: 'JOURNAL_REFRESH_FAILED' })

  async function save(config: NotificationChannelConfig, values: NotificationValues) {
    dispatch({ type: 'SAVE_STARTED' })
    try {
      await container.saveNotificationChannelConfig.execute(
        config.channel,
        toSaveRequest(values, config.credentials),
      )
      toast('Notifications enregistrées.', 'success')
      readConfig(config.channel, configKept)
      return true
    } catch (e) {
      toastError(toast, toAppError(e))
      return false
    } finally {
      dispatch({ type: 'SAVE_FINISHED' })
    }
  }

  return {
    onLoad(channel: NotificationChannelName) {
      dispatch({ type: 'CHANNEL_OPENED' })
      readConfig(channel, configInPlace)
      readLabels()
    },
    onRetryLabels: readLabels,

    /** Reads what the page shows below the settings, once the channel is known. */
    onOpen(channel: NotificationChannelName, acceptsCommands: boolean) {
      readLog(channel, logInPlace)
      if (!acceptsCommands) return
      readPairing(channel, pairingInPlace)
      readListening(channel, listeningInPlace)
      readJournal(channel, journalInPlace)
    },

    /** Resolves true once saved, so the view clears its draft; enabling asks first and resolves false. */
    async onSave(config: NotificationChannelConfig, values: NotificationValues) {
      if (values.enabled && !config.isEnabled) {
        dispatch({ type: 'ENABLE_ASKED' })
        return false
      }
      return save(config, values)
    },
    async onConfirmEnable(config: NotificationChannelConfig, values: NotificationValues) {
      const saved = await save(config, values)
      dispatch({ type: 'ENABLE_CLOSED' })
      return saved
    },
    onCancelEnable() {
      dispatch({ type: 'ENABLE_CLOSED' })
    },

    async onTest(channel: NotificationChannelName) {
      dispatch({ type: 'TEST_STARTED' })
      try {
        const result = await container.testNotificationChannel.execute(channel)
        if (result.success) toast('Message envoyé : le canal fonctionne.', 'success')
        else
          toast(
            'Échec de l’envoi.',
            'error',
            scrubSecrets(result.errorMessage ?? 'no reason given'),
          )
        readConfig(channel, configKept)
      } catch (e) {
        toastError(toast, toAppError(e))
      } finally {
        dispatch({ type: 'TEST_FINISHED' })
      }
    },

    onAskRemove() {
      dispatch({ type: 'REMOVE_ASKED' })
    },
    onCancelRemove() {
      dispatch({ type: 'REMOVE_CANCELLED' })
    },
    /** Resolves true once removed, so the view leaves for the channel list. */
    async onRemove(channel: NotificationChannelName) {
      dispatch({ type: 'REMOVE_STARTED' })
      try {
        await container.deleteNotificationChannel.execute(channel)
        toast('Canal supprimé.', 'info')
        return true
      } catch (e) {
        toastError(toast, toAppError(e))
        return false
      } finally {
        dispatch({ type: 'REMOVE_FINISHED' })
      }
    },

    onRetryPairing(channel: NotificationChannelName) {
      readPairing(channel, pairingInPlace)
      readListening(channel, listeningInPlace)
    },
    onRetryListening: (channel: NotificationChannelName) =>
      readListening(channel, listeningInPlace),
    /** The listening state rereads under its badge only when one is shown. */
    onRefreshPairing(channel: NotificationChannelName, listeningShown: boolean) {
      readPairing(channel, pairingKept)
      readListening(channel, listeningShown ? listeningKept : listeningInPlace)
    },
    async onStartPairing(channel: NotificationChannelName) {
      dispatch({ type: 'START_PAIRING_STARTED' })
      try {
        await container.startChannelPairing.execute(channel)
        readPairing(channel, pairingKept)
      } catch (e) {
        toastError(toast, toAppError(e))
      } finally {
        dispatch({ type: 'START_PAIRING_FINISHED' })
      }
    },
    onAskRevoke() {
      dispatch({ type: 'REVOKE_ASKED' })
    },
    onCancelRevoke() {
      dispatch({ type: 'REVOKE_CANCELLED' })
    },
    async onRevoke(channel: NotificationChannelName) {
      dispatch({ type: 'REVOKE_STARTED' })
      try {
        await container.revokeChannelPairing.execute(channel)
        toast('La conversation ne peut plus commander votre installation.', 'info')
        dispatch({ type: 'REVOKE_CANCELLED' })
        readPairing(channel, pairingKept)
      } catch (e) {
        toastError(toast, toAppError(e))
      } finally {
        dispatch({ type: 'REVOKE_FINISHED' })
      }
    },

    onRetryLog: (channel: NotificationChannelName) => readLog(channel, logInPlace),
    onRefreshLog: (channel: NotificationChannelName) => readLog(channel, logKept),
    onRetryJournal: (channel: NotificationChannelName) => readJournal(channel, journalInPlace),
    onRefreshJournal: (channel: NotificationChannelName) => readJournal(channel, journalKept),
  }
}
