import { toastError } from '../../common/errors/app_error'
import { toAppError } from '../../common/errors/to_app_error'
import type { Toast } from '../../common/components/toast'
import type { ChosenEnd } from '../../domain/entities/chosen_end.entity'
import type { Silence } from '../../domain/entities/silence.entity'
import type { CamerasContainer } from '../../infrastructure/providers/cameras.container'
import type { HubContainer } from '../../infrastructure/providers/hub.container'
import type { NotificationsContainer } from '../../infrastructure/providers/notifications.container'
import { reloadCameraList } from '../cameras/camera_list_reload'
import type { HubAction } from './hub.actions'
import { actOnPrivacy, setCamerasPrivacy } from './privacy_toggle'

/** The Détections tile counts a time window, never what the user has seen (UI-32). */
const RECENT_WINDOW_MS = 60 * 60 * 1000
/** The most the history answers in one page: past it the tile says « 100+ ». */
const RECENT_COUNT_MAX = 100

export interface HubPresenterContext {
  container: HubContainer
  camerasContainer: CamerasContainer
  notificationsContainer: NotificationsContainer
  dispatch: (action: HubAction) => void
  toast: Toast
  now?: () => Date
}

export function buildHubPresenter({
  container,
  camerasContainer,
  notificationsContainer,
  dispatch,
  toast,
  now = () => new Date(),
}: HubPresenterContext) {
  const reportFailure = (e: unknown) => toastError(toast, toAppError(e))

  async function readSilence() {
    try {
      dispatch({ type: 'SILENCE_READ', silence: await notificationsContainer.getSilence.execute() })
    } catch (e) {
      dispatch({ type: 'SILENCE_READ_FAILED' })
      reportFailure(e)
    }
  }

  async function changeSilence(change: () => Promise<Silence>) {
    dispatch({ type: 'SILENCE_CHANGE_STARTED' })
    try {
      dispatch({ type: 'SILENCE_CHANGED', silence: await change() })
    } catch (e) {
      dispatch({ type: 'SILENCE_CHANGE_FAILED' })
      reportFailure(e)
    }
  }

  return {
    onMount() {
      reloadCameraList(camerasContainer)
      void readSilence()
      container.getCamerasCut
        .execute()
        .then((cut) => dispatch({ type: 'CUT_READ', cut }))
        .catch(reportFailure)
      container.getHubOverview
        .execute()
        .then((overview) =>
          dispatch({
            type: 'OVERVIEW_LOADED',
            activeChannels: overview.notifications.activeChannels,
          }),
        )
        .catch(reportFailure)
      container.getDetectionHistory
        .execute({
          from: new Date(now().getTime() - RECENT_WINDOW_MS).toISOString(),
          limit: RECENT_COUNT_MAX,
        })
        .then((page) =>
          dispatch({
            type: 'DETECTIONS_COUNTED',
            recent: { count: page.items.length, more: page.nextCursor !== null },
          }),
        )
        .catch(reportFailure)
    },

    onReloadCameras() {
      reloadCameraList(camerasContainer)
    },

    /** One camera's eye, or resuming every camera: an immediate act (PRIV-21). */
    async onTogglePrivacy(cameraIds: readonly string[], active: boolean): Promise<void> {
      dispatch({ type: 'PRIVACY_STARTED', cameraIds })
      await setCamerasPrivacy(camerasContainer, toast, cameraIds, active)
      dispatch({ type: 'PRIVACY_FINISHED', cameraIds })
    },

    onOpenCut() {
      dispatch({ type: 'CUT_SHEET_SET', open: true })
    },

    onCloseCut() {
      dispatch({ type: 'CUT_SHEET_SET', open: false })
    },

    /** Every camera, until the end picked in the sheet; the cards say the result (PRIV-22). */
    async onCutCameras(cameraIds: readonly string[], end: ChosenEnd): Promise<void> {
      dispatch({ type: 'PRIVACY_STARTED', cameraIds })
      await actOnPrivacy(camerasContainer, toast, cameraIds, () =>
        container.cutCameras.execute(end),
      )
      dispatch({ type: 'PRIVACY_FINISHED', cameraIds })
    },

    /** A cut's end has come: the scheduler resumed the cameras, the cards follow without a reload. */
    onCutEnded() {
      reloadCameraList(camerasContainer)
    },

    onOpenSilence() {
      dispatch({ type: 'SILENCE_SHEET_SET', open: true })
    },

    onCloseSilence() {
      dispatch({ type: 'SILENCE_SHEET_SET', open: false })
    },

    onStartSilence(end: ChosenEnd): Promise<void> {
      return changeSilence(() => notificationsContainer.startSilence.execute(end))
    },

    /** A tap on the amber pill ends it, without confirmation (NOTIF-34). */
    onStopSilence(): Promise<void> {
      return changeSilence(() => notificationsContainer.stopSilence.execute())
    },

    /** Its hour has come: read it again rather than guess, a new one may have replaced it. */
    onSilenceEnded(): Promise<void> {
      return readSilence()
    },
  }
}
