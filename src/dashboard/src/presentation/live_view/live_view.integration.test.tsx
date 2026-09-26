import { describe, expect, it } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { PtzPreset } from '../../domain/entities/ptz_preset.entity'
import { failure, fakeNetwork, late, ok } from '../../testing/fake_network'
import { renderScreen } from '../../testing/render_screen'
import { LiveView } from './live_view.component'

const PRESETS = 'GET /api/cameras/camera-1/ptz/presets'
const STEP = 'POST /api/cameras/camera-1/ptz/step'
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
    stepsX: 3,
    stepsY: 2,
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

  it('onOpen_ShouldMarkThePositionTheCameraSitsOn_WhenItMatchesASavedOne', async () => {
    // Arrange
    fakeNetwork({
      [PRESETS]: presetsRead({
        presets: [makePreset({ presetId: 2, label: 'Parking', stepsX: 7, stepsY: 4 })],
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

  it('onPress_ShouldShowOneToastPerPress_WhenSeveralStepsOfAHoldFail', async () => {
    // Arrange: the first step answers after the hold has already sent the next one.
    const network = fakeNetwork({
      [PRESETS]: presetsRead(),
      [STEP]: late(failure(502, 'camera_refused', 'first step'), 600),
    })
    renderLiveView()
    const up = await screen.findByTitle('Haut')

    // Act
    fireEvent.mouseDown(up)
    await waitFor(() =>
      expect(network.sent).toContainEqual(expect.objectContaining({ route: STEP })),
    )
    network.answer(STEP, failure(502, 'camera_refused', 'held step'))
    await screen.findByText(/held step/)
    // Nothing on screen marks the first answer landing: wait past its 600 ms.
    await new Promise((resolve) => setTimeout(resolve, 600))

    // Assert
    expect(screen.getAllByText('La caméra a refusé la commande')).toHaveLength(1)
    expect(screen.queryByText(/first step/)).not.toBeInTheDocument()
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
    const network = fakeNetwork({ [PRESETS]: presetsRead(), [STEP]: late(ok(), 100) })
    const { unmount } = renderLiveView()
    fireEvent.mouseDown(await screen.findByTitle('Haut'))
    await waitFor(() => expect(network.sent).toHaveLength(3))

    // Act
    unmount()
    const sentAtClose = network.sent.length
    await new Promise((resolve) => setTimeout(resolve, 400))

    // Assert
    expect(network.sent).toHaveLength(sentAtClose)
  })
})
