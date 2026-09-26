import type { ToastTone } from '../../common/components/toast'
import { ApiErrorCode, toastError } from '../../common/errors/app_error'
import { toAppError } from '../../common/errors/to_app_error'
import { latestOnly } from '../../common/presenter/latest_only'
import type { CamerasContainer } from '../../infrastructure/providers/cameras.container'
import type { LiveViewAction } from './live_view.actions'
import type { PtzDirection } from './live_view.uido'

// Tap: one step, the server moves then stops. Hold: past this delay, steps chain until release.
const HOLD_THRESHOLD_MS = 300
const STEP_SPEED = 50
// The camera is still settling when the move answers: capture once it stands still.
const CAPTURE_DELAY_MS = 1500

export interface LiveViewPresenterContext {
  container: CamerasContainer
  dispatch: (action: LiveViewAction) => void
  toast: (message: string, tone?: ToastTone, diagnostic?: string) => void
}

export function buildLiveViewPresenter({ container, dispatch, toast }: LiveViewPresenterContext) {
  const nextPresetsRead = latestOnly()

  let pressed = false
  let holding = false
  let holdTimer: ReturnType<typeof setTimeout> | null = null
  // A hold fires a step every few hundred ms: a failure is shown once per press, not once per step.
  let refusalShown = false

  function reportStepFailure(e: unknown) {
    holding = false
    pressed = false
    if (refusalShown) return
    refusalShown = true
    toastError(toast, toAppError(e))
  }

  function stopHold() {
    pressed = false
    holding = false
    if (holdTimer) clearTimeout(holdTimer)
    holdTimer = null
  }

  function step(cameraId: string, direction: PtzDirection) {
    return container.ptzStep.execute(cameraId, direction, STEP_SPEED)
  }

  function chainSteps(cameraId: string, direction: PtzDirection) {
    step(cameraId, direction)
      .then(() => {
        if (holding) chainSteps(cameraId, direction)
      })
      .catch(reportStepFailure)
  }

  async function readPresets(cameraId: string) {
    const { presets, calibrated, currentPosition } = await container.getPtzPresets.execute(cameraId)
    dispatch({ type: 'PRESETS_LOADED', presets, calibrated, currentPosition })
  }

  function captureThumbnailSoon(cameraId: string, presetId: number) {
    setTimeout(() => {
      container.capturePtzPresetThumbnail
        .execute(cameraId, presetId)
        .then(() => dispatch({ type: 'THUMBNAIL_CAPTURED', presetId, version: Date.now() }))
        // A missed capture keeps the previous thumbnail: nothing the user has to act on.
        .catch(() => undefined)
    }, CAPTURE_DELAY_MS)
  }

  async function save(cameraId: string, presetId: number, label: string) {
    dispatch({ type: 'SAVE_STARTED', presetId })
    try {
      await container.ptzSaveCurrentAsPreset.execute(cameraId, presetId)
      toast(`Position « ${label} » enregistrée.`, 'success')
      await readPresets(cameraId)
      dispatch({ type: 'SAVE_SUCCEEDED', presetId })
      captureThumbnailSoon(cameraId, presetId)
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
      if (pressed) return
      pressed = true
      holding = false
      refusalShown = false
      dispatch({ type: 'MOVE_STARTED' })
      step(cameraId, direction).catch(reportStepFailure)
      holdTimer = setTimeout(() => {
        if (!pressed) return
        holding = true
        chainSteps(cameraId, direction)
      }, HOLD_THRESHOLD_MS)
    },

    // Closing the view mid-hold must not leave steps chaining.
    onClose: stopHold,

    onRelease() {
      if (pressed) stopHold()
    },

    async onGoTo(cameraId: string, presetId: number, label: string) {
      dispatch({ type: 'GOTO_STARTED', presetId })
      try {
        await container.ptzGoToPreset.execute(cameraId, presetId)
        dispatch({ type: 'GOTO_SUCCEEDED', presetId })
        // A move takes time: without an acknowledgement, the press looks like it did nothing.
        toast(`Caméra en position « ${label} ».`, 'success')
        captureThumbnailSoon(cameraId, presetId)
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
