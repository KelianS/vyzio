import type { ToastTone } from '../../common/components/toast'
import { ApiErrorCode, toastError } from '../../common/errors/app_error'
import { toAppError } from '../../common/errors/to_app_error'
import { latestOnly } from '../../common/presenter/latest_only'
import type { CamerasContainer } from '../../infrastructure/providers/cameras.container'
import type { LiveViewAction } from './live_view.actions'
import type { PtzDirection } from './live_view.uido'

// Released before this delay, a press is a tap: one short move. Held past it, one move lasts until release (ADR-60).
const HOLD_THRESHOLD_MS = 300
// Well within the few seconds after which the server stops a hold it no longer hears about (ADR-60).
const HOLD_SIGNAL_MS = 1000
const STEP_SPEED = 50
// The camera is still settling when the move answers: capture once it stands still.
const CAPTURE_DELAY_MS = 1500

export interface LiveViewPresenterContext {
  container: CamerasContainer
  dispatch: (action: LiveViewAction) => void
  toast: (message: string, tone?: ToastTone, diagnostic?: string) => void
}

interface Press {
  cameraId: string
  direction: PtzDirection
}

interface Hold {
  cameraId: string
  /** Settles on whether the server started the move, its failure already shown. */
  started: Promise<boolean>
  signal: ReturnType<typeof setInterval> | null
}

export function buildLiveViewPresenter({ container, dispatch, toast }: LiveViewPresenterContext) {
  const nextPresetsRead = latestOnly()

  let press: Press | null = null
  let holdTimer: ReturnType<typeof setTimeout> | null = null
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

  function startHold({ cameraId, direction }: Press) {
    const current: Hold = { cameraId, started: Promise.resolve(false), signal: null }
    current.started = container.ptzStartMove
      .execute(cameraId, direction, STEP_SPEED)
      .then(() => {
        if (hold === current) current.signal = setInterval(() => signal(current), HOLD_SIGNAL_MS)
        return true
      })
      .catch((e: unknown) => {
        reportMoveFailure(e)
        return false
      })
    hold = current
  }

  // The stop waits for the start: a release during it must not leave the camera moving.
  function endHold() {
    const current = hold
    hold = null
    if (!current) return
    stopSignalling(current)
    void current.started.then((started) => {
      if (started) container.ptzStopMove.execute(current.cameraId).catch(reportMoveFailure)
    })
  }

  function endPress() {
    press = null
    if (holdTimer) clearTimeout(holdTimer)
    holdTimer = null
    endHold()
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
      if (press) return
      const current: Press = { cameraId, direction }
      press = current
      failureShown = false
      dispatch({ type: 'MOVE_STARTED' })
      holdTimer = setTimeout(() => {
        holdTimer = null
        if (press === current) startHold(current)
      }, HOLD_THRESHOLD_MS)
    },

    // Closing the view mid-hold stops the camera; a press cut short by it is no tap.
    onClose: endPress,

    onRelease() {
      const current = press
      if (!current) return
      const tapped = holdTimer !== null
      endPress()
      if (tapped) {
        container.ptzStep
          .execute(current.cameraId, current.direction, STEP_SPEED)
          .catch(reportMoveFailure)
      }
    },

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
