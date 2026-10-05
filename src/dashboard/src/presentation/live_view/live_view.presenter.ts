import type { ToastTone } from '../../common/components/toast'
import { ApiErrorCode, toastError } from '../../common/errors/app_error'
import { toAppError } from '../../common/errors/to_app_error'
import { latestOnly } from '../../common/presenter/latest_only'
import type { CamerasContainer } from '../../infrastructure/providers/cameras.container'
import type { LiveViewAction } from './live_view.actions'
import type { PtzDirection } from './live_view.uido'

// Well within the few seconds after which the server stops a hold it no longer hears about (ADR-60).
const HOLD_SIGNAL_MS = 1000
const MOVE_SPEED = 50
// The camera is still settling when the move answers: capture once it stands still.
const CAPTURE_DELAY_MS = 1500

export interface LiveViewPresenterContext {
  container: CamerasContainer
  dispatch: (action: LiveViewAction) => void
  toast: (message: string, tone?: ToastTone, diagnostic?: string) => void
}

interface Hold {
  cameraId: string
  signal: ReturnType<typeof setInterval> | null
}

export function buildLiveViewPresenter({ container, dispatch, toast }: LiveViewPresenterContext) {
  const nextPresetsRead = latestOnly()

  let hold: Hold | null = null
  // A press sends up to three calls: a failure is shown once per press, not once per call.
  let failureShown = false

  function reportMoveFailure(e: unknown) {
    if (failureShown) return
    failureShown = true
    toastError(toast, toAppError(e))
  }

  function stopSignalling(current: Hold) {
    if (current.signal) clearInterval(current.signal)
    current.signal = null
  }

  function signal(current: Hold) {
    container.ptzSignalMove
      .execute(current.cameraId)
      .then((held) => {
        if (!held) stopSignalling(current)
      })
      .catch((e: unknown) => {
        stopSignalling(current)
        reportMoveFailure(e)
      })
  }

  // Every press is one move, started at once so the camera opens its session while the finger is down (ADR-60).
  function startHold(cameraId: string, direction: PtzDirection) {
    const current: Hold = { cameraId, signal: null }
    current.signal = setInterval(() => signal(current), HOLD_SIGNAL_MS)
    hold = current
    container.ptzStartMove.execute(cameraId, direction, MOVE_SPEED).catch((e: unknown) => {
      stopSignalling(current)
      reportMoveFailure(e)
    })
  }

  // The stop does not wait for the start: the server keeps the camera moving for its minimum time, then stops it (ADR-60).
  function endHold() {
    const current = hold
    hold = null
    if (!current) return
    stopSignalling(current)
    container.ptzStopMove.execute(current.cameraId).catch(reportMoveFailure)
  }

  async function readPresets(cameraId: string) {
    const { presets, calibrated, currentPosition } = await container.getPtzPresets.execute(cameraId)
    dispatch({ type: 'PRESETS_LOADED', presets, calibrated, currentPosition })
  }

  // A missed capture fails under a thumbnail already shown: it stays, and a toast says so (DESIGN SYSTEM § Errors).
  function captureThumbnailSoon(cameraId: string, presetId: number, label: string) {
    setTimeout(() => {
      container.capturePtzPresetThumbnail
        .execute(cameraId, presetId)
        .then(() => dispatch({ type: 'THUMBNAIL_CAPTURED', presetId, version: Date.now() }))
        .catch((e: unknown) => {
          toastError(
            toast,
            toAppError(e),
            `La miniature de la position « ${label} » n’a pas été mise à jour.`,
          )
        })
    }, CAPTURE_DELAY_MS)
  }

  async function save(cameraId: string, presetId: number, label: string) {
    dispatch({ type: 'SAVE_STARTED', presetId })
    try {
      await container.ptzSaveCurrentAsPreset.execute(cameraId, presetId)
      toast(`Position « ${label} » enregistrée.`, 'success')
      await readPresets(cameraId)
      dispatch({ type: 'SAVE_SUCCEEDED', presetId })
      captureThumbnailSoon(cameraId, presetId, label)
    } catch (e) {
      const error = toAppError(e)
      if (error.code === ApiErrorCode.NotCalibrated) dispatch({ type: 'CALIBRATION_LOST' })
      toastError(toast, error)
    } finally {
      dispatch({ type: 'PRESET_ACTION_FINISHED', presetId })
    }
  }

  return {
    // Moving to another camera keeps the view mounted: only the latest read may answer.
    onOpen(cameraId: string) {
      const isLatest = nextPresetsRead()
      dispatch({ type: 'PRESETS_STARTED' })
      container.getPtzPresets
        .execute(cameraId)
        .then(({ presets, calibrated, currentPosition }) => {
          if (isLatest()) dispatch({ type: 'PRESETS_LOADED', presets, calibrated, currentPosition })
        })
        .catch((e: unknown) => {
          if (isLatest()) dispatch({ type: 'PRESETS_FAILED', error: toAppError(e) })
        })
    },

    onPress(cameraId: string, direction: PtzDirection) {
      if (hold) return
      failureShown = false
      dispatch({ type: 'MOVE_STARTED' })
      startHold(cameraId, direction)
    },

    // Closing the view mid-press stops the camera.
    onClose: endHold,
    onRelease: endHold,

    async onGoTo(cameraId: string, presetId: number, label: string) {
      dispatch({ type: 'GOTO_STARTED', presetId })
      try {
        await container.ptzGoToPreset.execute(cameraId, presetId)
        dispatch({ type: 'GOTO_SUCCEEDED', presetId })
        // A move takes time: without an acknowledgement, the press looks like it did nothing.
        toast(`Caméra en position « ${label} ».`, 'success')
        captureThumbnailSoon(cameraId, presetId, label)
      } catch (e) {
        toastError(toast, toAppError(e))
      } finally {
        dispatch({ type: 'PRESET_ACTION_FINISHED', presetId })
      }
    },

    onSave: save,

    onAskOverride(presetId: number) {
      dispatch({ type: 'OVERRIDE_ASKED', presetId })
    },
    onCancelOverride() {
      dispatch({ type: 'OVERRIDE_CLOSED' })
    },
    async onConfirmOverride(cameraId: string, presetId: number, label: string) {
      await save(cameraId, presetId, label)
      dispatch({ type: 'OVERRIDE_CLOSED' })
    },

    async onCalibrate(cameraId: string) {
      dispatch({ type: 'CALIBRATE_STARTED' })
      try {
        await container.ptzCalibrate.execute(cameraId)
        await readPresets(cameraId)
        toast('Caméra calibrée. Les positions sont de nouveau utilisables.', 'success')
      } catch (e) {
        toastError(toast, toAppError(e))
      } finally {
        dispatch({ type: 'CALIBRATE_FINISHED' })
      }
    },
  }
}
