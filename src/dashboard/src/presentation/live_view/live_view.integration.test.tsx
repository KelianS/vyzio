import { describe, expect, it } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { PtzPreset } from '../../domain/entities/ptz_preset.entity'
import { failure, fakeNetwork, late, ok } from '../../testing/fake_network'
import { renderScreen } from '../../testing/render_screen'
import { LiveView } from './live_view.component'

const PRESETS = 'GET /api/cameras/camera-1/ptz/presets'
const STEP = 'POST /api/cameras/camera-1/ptz/step'
const START = 'POST /api/cameras/camera-1/ptz/move/start'
const SIGNAL = 'POST /api/cameras/camera-1/ptz/move/signal'
const STOP = 'POST /api/cameras/camera-1/ptz/move/stop'
const SAVE = 'POST /api/cameras/camera-1/ptz/preset/save'
const GOTO = 'POST /api/cameras/camera-1/ptz/preset/goto'
const CALIBRATE = 'POST /api/cameras/camera-1/ptz/calibrate'
const CAPTURE = 'POST /api/cameras/camera-1/ptz/presets/1/snapshot'

// The thumbnail is captured once the camera stands still, 1.5 s after the move answers.
async function theThumbnailIsCaptured(network: ReturnType<typeof fakeNetwork>) {
  await waitFor(
    () => expect(network.sent).toContainEqual(expect.objectContaining({ route: CAPTURE })),
    {
      timeout: 3000,
    },
  )
}

function makePreset(overrides: Partial<PtzPreset> = {}): PtzPreset {
  return {
    presetId: 1,
    label: 'Surveillance',
    native: false,
    panMs: 3,
    tiltMs: 2,
    configured: true,
    ...overrides,
  }
}

function presetsRead({
  presets = [] as PtzPreset[],
  calibrated = true,
  currentPosition = null as { x: number; y: number } | null,
} = {}) {
  return ok({ presets, calibrated, currentPosition })
}

// A long press on a saved position asks before redefining it.
async function askToRedefineSurveillance() {
  fireEvent.mouseDown(await screen.findByTitle(/^Surveillance \(appui/))
  await screen.findByText('Redéfinir cette position ?', undefined, { timeout: 2000 })
}

// A held press signals once a second: the first signal leaves about 1.3 s after the press.
async function sentWithin(network: ReturnType<typeof fakeNetwork>, route: string, timeout = 1000) {
  await waitFor(() => expect(network.sent).toContainEqual(expect.objectContaining({ route })), {
    timeout,
  })
}

function renderLiveView() {
  return renderScreen(<LiveView cameraId="camera-1" label="Front Door" ptzSupported />)
}

describe('LiveView', () => {
  it('onSave_ShouldSaveTheEmptyPositionAndCaptureIt_WhenTheUserTapsIt', async () => {
    // Arrange
    const network = fakeNetwork({ [PRESETS]: presetsRead(), [SAVE]: ok(), [CAPTURE]: ok() })
    renderLiveView()
    const empty = await screen.findAllByTitle('Enregistrer la position actuelle ici')

    // Act
    await userEvent.click(empty[0])

    // Assert
    expect(await screen.findByText('Position « Surveillance » enregistrée.')).toBeInTheDocument()
    expect(network.sent).toContainEqual(
      expect.objectContaining({ route: SAVE, body: { presetId: 1 } }),
    )
    await theThumbnailIsCaptured(network)
  })

  it('onGoTo_ShouldAcknowledgeTheArrivalAndRecapture_WhenTheCameraReachesTheSavedPosition', async () => {
    // Arrange
    const network = fakeNetwork({
      [PRESETS]: presetsRead({ presets: [makePreset()] }),
      [GOTO]: ok(),
      [CAPTURE]: ok(),
    })
    renderLiveView()
    const tile = await screen.findByTitle(/^Surveillance \(appui/)

    // Act
    await userEvent.click(tile)

    // Assert
    expect(await screen.findByText('Caméra en position « Surveillance ».')).toBeInTheDocument()
    expect(network.sent).toContainEqual(
      expect.objectContaining({ route: GOTO, body: { presetId: 1 } }),
    )
    await theThumbnailIsCaptured(network)
  })

  it('onGoTo_ShouldSayThePreviewWasNotUpdated_WhenTheCaptureFails', async () => {
    // Arrange
    fakeNetwork({
      [PRESETS]: presetsRead({ presets: [makePreset()] }),
      [GOTO]: ok(),
      [CAPTURE]: failure(500),
    })
    renderLiveView()
    const tile = await screen.findByTitle(/^Surveillance \(appui/)

    // Act
    await userEvent.click(tile)

    // Assert
    expect(
      await screen.findByText(
        'La miniature de la position « Surveillance » n’a pas été mise à jour.',
        undefined,
        { timeout: 3000 },
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/POST \/api\/cameras\/camera-1\/ptz\/presets\/1\/snapshot · 500/),
    ).toBeVisible()
    expect(screen.getByTitle(/^Surveillance \(appui/)).toBeInTheDocument()
  })

  it('onOpen_ShouldMarkThePositionTheCameraSitsOn_WhenItMatchesASavedOne', async () => {
    // Arrange
    fakeNetwork({
      [PRESETS]: presetsRead({
        presets: [makePreset({ presetId: 2, label: 'Parking', panMs: 7, tiltMs: 4 })],
        currentPosition: { x: 7, y: 4 },
      }),
    })

    // Act
    renderLiveView()

    // Assert
    expect(await screen.findByTitle(/^Parking \(appui/)).toHaveAttribute('aria-pressed', 'true')
  })

  it('onCalibrate_ShouldCalibrateAndSaySo_WhenTheCameraHasNoReference', async () => {
    // Arrange
    const network = fakeNetwork({
      [PRESETS]: presetsRead({ calibrated: false }),
      [CALIBRATE]: ok(),
    })
    renderLiveView()
    await screen.findByText(/pas de position de référence/)
    network.answer(PRESETS, presetsRead())

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Calibrer maintenant' }))

    // Assert
    expect(
      await screen.findByText('Caméra calibrée. Les positions sont de nouveau utilisables.'),
    ).toBeInTheDocument()
    expect(screen.queryByText(/pas de position de référence/)).not.toBeInTheDocument()
  })

  it('onCalibrate_ShouldSayWhyAndNeverClaimSuccess_WhenTheCameraTookNoStep', async () => {
    // Arrange
    fakeNetwork({
      [PRESETS]: presetsRead({ calibrated: false }),
      [CALIBRATE]: failure(
        502,
        'camera_refused',
        'PTZ homing over Dvrip: the camera took none of the 60 steps toward its limit.',
      ),
    })
    renderLiveView()
    await screen.findByText(/pas de position de référence/)

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Calibrer maintenant' }))

    // Assert
    expect(await screen.findByText('La caméra a refusé la commande')).toBeInTheDocument()
    expect(screen.getByText(/took none of the 60 steps/)).toBeVisible()
    expect(screen.queryByText(/Caméra calibrée/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Calibrer maintenant' })).toBeEnabled()
  })

  it('onOpen_ShouldSayWhyAndForSupport_WhenThePositionsCannotBeRead', async () => {
    // Arrange
    fakeNetwork({ [PRESETS]: failure(500) })

    // Act
    renderLiveView()

    // Assert
    expect(await screen.findByText(/Vyzio a rencontré une erreur/)).toBeInTheDocument()
    expect(screen.getByText(/GET \/api\/cameras\/camera-1\/ptz\/presets · 500/)).toBeVisible()
  })

  it('onPress_ShouldSayTheCameraRefusedAndShowWhy_WhenTheCameraRefusesTheMove', async () => {
    // Arrange
    fakeNetwork({ [PRESETS]: presetsRead(), [STEP]: failure(502, 'camera_refused') })
    renderLiveView()

    // Act
    await userEvent.click(await screen.findByTitle('Haut'))

    // Assert
    expect(await screen.findByText('La caméra a refusé la commande')).toBeInTheDocument()
    expect(screen.getByText(/POST \/api\/cameras\/camera-1\/ptz\/step · 502/)).toBeVisible()
  })

  it('onRelease_ShouldSendOneTapAndNoHold_WhenTheUserReleasesQuickly', async () => {
    // Arrange
    const network = fakeNetwork({ [PRESETS]: presetsRead(), [STEP]: ok() })
    renderLiveView()

    // Act
    await userEvent.click(await screen.findByTitle('Gauche'))

    // Assert
    await sentWithin(network, STEP)
    expect(network.sent).toContainEqual(
      expect.objectContaining({ route: STEP, body: { direction: 'Left', speed: 50 } }),
    )
    expect(network.sent).not.toContainEqual(expect.objectContaining({ route: START }))
  })

  it('onRelease_ShouldStopTheOneMoveOfTheHold_WhenTheUserReleasesAHeldDirection', async () => {
    // Arrange
    const network = fakeNetwork({ [PRESETS]: presetsRead(), [START]: ok(), [STOP]: ok() })
    renderLiveView()
    const up = await screen.findByTitle('Haut')
    fireEvent.mouseDown(up)
    await sentWithin(network, START)

    // Act
    fireEvent.mouseUp(up)

    // Assert
    await sentWithin(network, STOP)
    expect(network.sent).toContainEqual(
      expect.objectContaining({ route: START, body: { direction: 'Up', speed: 50 } }),
    )
    expect(network.sent).not.toContainEqual(expect.objectContaining({ route: STEP }))
  })

  it('onPress_ShouldSignalTheHold_WhenThePressLasts', async () => {
    // Arrange
    const network = fakeNetwork({ [PRESETS]: presetsRead(), [START]: ok(), [SIGNAL]: ok() })
    renderLiveView()

    // Act
    fireEvent.mouseDown(await screen.findByTitle('Bas'))

    // Assert
    await sentWithin(network, SIGNAL, 2500)
  })

  it('onRelease_ShouldStopTheHold_WhenThePointerLeavesTheButton', async () => {
    // Arrange
    const network = fakeNetwork({ [PRESETS]: presetsRead(), [START]: ok(), [STOP]: ok() })
    renderLiveView()
    const up = await screen.findByTitle('Haut')
    fireEvent.mouseDown(up)
    await sentWithin(network, START)

    // Act
    fireEvent.mouseLeave(up)

    // Assert
    await sentWithin(network, STOP)
  })

  it('onRelease_ShouldSendOneTap_WhenThePointerLeavesTheButtonQuickly', async () => {
    // Arrange
    const network = fakeNetwork({ [PRESETS]: presetsRead(), [STEP]: ok() })
    renderLiveView()
    const right = await screen.findByTitle('Droite')
    fireEvent.mouseDown(right)

    // Act
    fireEvent.mouseLeave(right)

    // Assert
    await sentWithin(network, STEP)
    expect(network.sent).not.toContainEqual(expect.objectContaining({ route: START }))
  })

  it('onRelease_ShouldStopTheHold_WhenTheTouchIsCancelled', async () => {
    // Arrange
    const network = fakeNetwork({ [PRESETS]: presetsRead(), [START]: ok(), [STOP]: ok() })
    renderLiveView()
    const down = await screen.findByTitle('Bas')
    fireEvent.touchStart(down)
    await sentWithin(network, START)

    // Act
    fireEvent.touchCancel(down)

    // Assert
    await sentWithin(network, STOP)
  })

  it('onPress_ShouldStopSignalling_WhenTheServerNoLongerHoldsTheMove', async () => {
    // Arrange
    const network = fakeNetwork({ [PRESETS]: presetsRead(), [START]: ok(), [SIGNAL]: failure(404) })
    renderLiveView()
    fireEvent.mouseDown(await screen.findByTitle('Haut'))
    await sentWithin(network, SIGNAL, 2500)

    // Act
    // Nothing on screen marks a signal not sent: wait past the next one.
    await new Promise((resolve) => setTimeout(resolve, 1200))

    // Assert
    expect(network.sent.filter(({ route }) => route === SIGNAL)).toHaveLength(1)
  })

  it('onRelease_ShouldStopOnlyOnceTheStartAnswered_WhenReleasedWhileTheMoveStarts', async () => {
    // Arrange
    const network = fakeNetwork({
      [PRESETS]: presetsRead(),
      [START]: late(ok(), 400),
      [STOP]: ok(),
    })
    renderLiveView()
    const up = await screen.findByTitle('Haut')
    fireEvent.mouseDown(up)
    await sentWithin(network, START)

    // Act
    fireEvent.mouseUp(up)

    // Assert
    expect(network.sent).not.toContainEqual(expect.objectContaining({ route: STOP }))
    await sentWithin(network, STOP)
  })

  it('onPress_ShouldSayTheCameraRefusedAndSendNoStop_WhenTheCameraRefusesTheHold', async () => {
    // Arrange
    const network = fakeNetwork({
      [PRESETS]: presetsRead(),
      [START]: failure(502, 'camera_refused'),
    })
    renderLiveView()
    const up = await screen.findByTitle('Haut')
    fireEvent.mouseDown(up)
    expect(await screen.findByText('La caméra a refusé la commande')).toBeInTheDocument()

    // Act
    fireEvent.mouseUp(up)

    // Assert
    expect(screen.getByText(/POST \/api\/cameras\/camera-1\/ptz\/move\/start · 502/)).toBeVisible()
    expect(network.sent).not.toContainEqual(expect.objectContaining({ route: STOP }))
  })

  it('onRelease_ShouldShowOneToastPerPress_WhenTheSignalAndTheStopOfAHoldFail', async () => {
    // Arrange
    const network = fakeNetwork({
      [PRESETS]: presetsRead(),
      [START]: ok(),
      [SIGNAL]: failure(503, undefined, 'signal lost'),
      [STOP]: failure(503, undefined, 'stop lost'),
    })
    renderLiveView()
    const up = await screen.findByTitle('Haut')
    fireEvent.mouseDown(up)
    await screen.findByText(/signal lost/, undefined, { timeout: 2500 })

    // Act
    fireEvent.mouseUp(up)
    await sentWithin(network, STOP)

    // Assert
    expect(screen.queryByText(/stop lost/)).not.toBeInTheDocument()
  })

  it('onContextMenu_ShouldKeepTheBrowserMenuClosed_WhenTheUserLongPressesAPosition', async () => {
    // Arrange
    fakeNetwork({ [PRESETS]: presetsRead({ presets: [makePreset()] }) })
    renderLiveView()
    const tile = await screen.findByTitle(/^Surveillance \(appui/)

    // Act
    const menuAllowed = fireEvent.contextMenu(tile)

    // Assert
    expect(menuAllowed).toBe(false)
  })

  it('onConfirmOverride_ShouldRedefineThePosition_WhenTheUserConfirms', async () => {
    // Arrange
    const network = fakeNetwork({
      [PRESETS]: presetsRead({ presets: [makePreset()] }),
      [SAVE]: ok(),
      [CAPTURE]: ok(),
    })
    renderLiveView()
    await askToRedefineSurveillance()

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Redéfinir' }))

    // Assert
    expect(await screen.findByText('Position « Surveillance » enregistrée.')).toBeInTheDocument()
    expect(screen.queryByText('Redéfinir cette position ?')).not.toBeInTheDocument()
    expect(network.sent).toContainEqual(
      expect.objectContaining({ route: SAVE, body: { presetId: 1 } }),
    )
    await theThumbnailIsCaptured(network)
  })

  it('onCancelOverride_ShouldKeepTheSavedPosition_WhenTheUserCancels', async () => {
    // Arrange
    const network = fakeNetwork({ [PRESETS]: presetsRead({ presets: [makePreset()] }) })
    renderLiveView()
    await askToRedefineSurveillance()

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Annuler' }))

    // Assert
    expect(screen.queryByText('Redéfinir cette position ?')).not.toBeInTheDocument()
    expect(network.sent).not.toContainEqual(expect.objectContaining({ route: SAVE }))
  })

  it('onSave_ShouldSayThePositionsNeedACalibration_WhenTheCameraLostItsReference', async () => {
    // Arrange
    fakeNetwork({ [PRESETS]: presetsRead(), [SAVE]: failure(409, 'not_calibrated') })
    renderLiveView()
    const empty = await screen.findAllByTitle('Enregistrer la position actuelle ici')

    // Act
    await userEvent.click(empty[0])

    // Assert
    expect(await screen.findByText(/pas de position de référence/)).toBeInTheDocument()
  })

  it('onClose_ShouldStopTheHold_WhenTheViewClosesWhileADirectionIsHeld', async () => {
    // Arrange
    const network = fakeNetwork({ [PRESETS]: presetsRead(), [START]: ok(), [STOP]: ok() })
    const { unmount } = renderLiveView()
    fireEvent.mouseDown(await screen.findByTitle('Haut'))
    await sentWithin(network, START)

    // Act
    unmount()

    // Assert
    await sentWithin(network, STOP)
  })
})
