import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { PtzPreset } from '../../domain/entities/ptz_preset.entity'
import { failure, fakeNetwork, late, ok } from '../../testing/fake_network'
import { renderScreen } from '../../testing/render_screen'
import { FakeSocket, stubBrowserMse } from '../../testing/fake_mse'
import type { LiveQuality } from '../../domain/entities/camera.entity'
import { LiveView } from './live_view.component'
import { OrientationControl } from '../../common/orientation/orientation_control'

const PRESETS = 'GET /api/cameras/camera-1/ptz/presets'
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
    thumbnail: true,
    panMs: 3,
    tiltMs: 2,
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

// A held press signals once a second: the first signal leaves about 1 s after the press.
async function sentWithin(network: ReturnType<typeof fakeNetwork>, route: string, timeout = 1000) {
  await waitFor(() => expect(network.sent).toContainEqual(expect.objectContaining({ route })), {
    timeout,
  })
}

function renderLiveView() {
  return renderScreen(
    <LiveView
      cameraId="camera-1"
      label="Front Door"
      orientation={OrientationControl.Usable}
      qualities={['low']}
    />,
  )
}

describe('LiveView', () => {
  it('LiveView_ShouldSayOrientationIsUnavailableAndPointAtConnexion_WhenTheCameraWouldRefuseTheMoves', () => {
    // Arrange
    const network = fakeNetwork({})

    // Act
    renderScreen(
      <LiveView
        cameraId="camera-1"
        label="Front Door"
        orientation={OrientationControl.Unusable}
        qualities={['low']}
      />,
    )

    // Assert
    expect(
      screen.getByText(/L’orientation n’est pas disponible pour le moment/),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Connexion' })).toHaveAttribute(
      'href',
      '/settings/cameras/camera-1/connexion',
    )
    expect(screen.queryByTitle('Haut')).not.toBeInTheDocument()
    expect(network.sent).toEqual([])
  })

  it('LiveView_ShouldShowOnlyThePicture_WhenOrientationIsSwitchedOff', () => {
    // Arrange
    const network = fakeNetwork({})

    // Act
    renderScreen(
      <LiveView
        cameraId="camera-1"
        label="Front Door"
        orientation={OrientationControl.Off}
        qualities={['low']}
      />,
    )

    // Assert
    expect(screen.queryByText(/L’orientation n’est pas disponible/)).not.toBeInTheDocument()
    expect(screen.queryByTitle('Haut')).not.toBeInTheDocument()
    expect(network.sent).toEqual([])
  })

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

  it('onOpen_ShouldSayThePositionsWereNotReadAndOfferNoSlot_WhenTheCameraCannotSayWhichItHolds', async () => {
    // Arrange
    fakeNetwork({ [PRESETS]: failure(502, 'camera_unreachable') })

    // Act
    renderLiveView()

    // Assert
    expect(
      await screen.findByText('Les positions de cette caméra n’ont pas pu être lues.'),
    ).toBeInTheDocument()
    expect(screen.getByText(/GET \/api\/cameras\/camera-1\/ptz\/presets · 502/)).toBeVisible()
    expect(screen.queryByTitle('Enregistrer la position actuelle ici')).not.toBeInTheDocument()
  })

  it('onRetryPresets_ShouldShowTheSlots_WhenTheCameraAnswersTheNextRead', async () => {
    // Arrange
    const network = fakeNetwork({ [PRESETS]: failure(502, 'camera_unreachable') })
    renderLiveView()
    const retry = await screen.findByRole('button', { name: 'Réessayer' })
    network.answer(PRESETS, presetsRead({ presets: [makePreset()] }))

    // Act
    await userEvent.click(retry)

    // Assert
    expect(await screen.findByTitle(/^Surveillance \(appui/)).toBeInTheDocument()
    expect(screen.queryByText(/n’ont pas pu être lues/)).not.toBeInTheDocument()
  })

  it('onOpen_ShouldShowAHeldSlotAndNeverAnEmptyOne_WhenTheCameraHoldsAPositionWithoutThumbnail', async () => {
    // Arrange
    fakeNetwork({
      [PRESETS]: presetsRead({
        presets: [makePreset({ presetId: 2, label: 'Parking', thumbnail: false })],
      }),
    })

    // Act
    renderLiveView()

    // Assert
    expect(
      await screen.findByTitle(
        'Parking (appui : y aller et prendre sa miniature, appui long : redéfinir ici)',
      ),
    ).toBeInTheDocument()
    expect(screen.getAllByTitle('Enregistrer la position actuelle ici')).toHaveLength(3)
  })

  it('onGoTo_ShouldMoveThereAndTakeTheThumbnail_WhenTheUserTapsAHeldSlotWithoutOne', async () => {
    // Arrange
    const network = fakeNetwork({
      [PRESETS]: presetsRead({ presets: [makePreset({ thumbnail: false })] }),
      [GOTO]: ok(),
      [CAPTURE]: ok(),
    })
    renderLiveView()
    const tile = await screen.findByTitle(/^Surveillance \(appui : y aller et prendre sa miniature/)

    // Act
    await userEvent.click(tile)

    // Assert
    expect(network.sent).toContainEqual(
      expect.objectContaining({ route: GOTO, body: { presetId: 1 } }),
    )
    await theThumbnailIsCaptured(network)
  })

  it('onAskOverride_ShouldAskFirst_WhenTheUserLongPressesAHeldSlotWithoutThumbnail', async () => {
    // Arrange
    fakeNetwork({ [PRESETS]: presetsRead({ presets: [makePreset({ thumbnail: false })] }) })
    renderLiveView()

    // Act
    fireEvent.mouseDown(await screen.findByTitle(/^Surveillance \(appui/))

    // Assert
    expect(
      await screen.findByText('Redéfinir cette position ?', undefined, { timeout: 2000 }),
    ).toBeInTheDocument()
  })

  it('onPress_ShouldSayTheCameraRefusedAndShowWhy_WhenTheCameraRefusesTheMove', async () => {
    // Arrange
    fakeNetwork({ [PRESETS]: presetsRead(), [START]: failure(502, 'camera_refused'), [STOP]: ok() })
    renderLiveView()

    // Act
    await userEvent.click(await screen.findByTitle('Haut'))

    // Assert
    expect(await screen.findByText('La caméra a refusé la commande')).toBeInTheDocument()
    expect(screen.getByText(/POST \/api\/cameras\/camera-1\/ptz\/move\/start · 502/)).toBeVisible()
  })

  it('onPress_ShouldStartTheMoveAtOnce_WhenTheUserPressesADirection', async () => {
    // Arrange
    const network = fakeNetwork({ [PRESETS]: presetsRead(), [START]: ok() })
    renderLiveView()
    const left = await screen.findByTitle('Gauche')

    // Act
    fireEvent.mouseDown(left)

    // Assert
    await sentWithin(network, START, 100)
    expect(network.sent).toContainEqual(
      expect.objectContaining({ route: START, body: { direction: 'Left', speed: 50 } }),
    )
    expect(network.sent).not.toContainEqual(expect.objectContaining({ route: STOP }))
  })

  it('onRelease_ShouldStopAtOnceWithoutWaitingForTheStart_WhenTheUserTapsADirection', async () => {
    // Arrange
    const network = fakeNetwork({
      [PRESETS]: presetsRead(),
      [START]: late(ok(), 1000),
      [STOP]: ok(),
    })
    renderLiveView()
    const left = await screen.findByTitle('Gauche')

    // Act
    await userEvent.click(left)

    // Assert
    await sentWithin(network, STOP, 300)
    expect(network.sent.map(({ route }) => route).filter((route) => route !== PRESETS)).toEqual([
      START,
      STOP,
    ])
  })

  it('onRelease_ShouldStopTheOneMoveOfThePress_WhenTheUserReleasesAHeldDirection', async () => {
    // Arrange
    const network = fakeNetwork({
      [PRESETS]: presetsRead(),
      [START]: ok(),
      [SIGNAL]: ok(),
      [STOP]: ok(),
    })
    renderLiveView()
    const up = await screen.findByTitle('Haut')
    fireEvent.mouseDown(up)
    await sentWithin(network, SIGNAL, 2500)

    // Act
    fireEvent.mouseUp(up)

    // Assert
    await sentWithin(network, STOP)
    expect(network.sent.filter(({ route }) => route === START)).toHaveLength(1)
  })

  it('onPress_ShouldSignalTheMove_WhenThePressLasts', async () => {
    // Arrange
    const network = fakeNetwork({ [PRESETS]: presetsRead(), [START]: ok(), [SIGNAL]: ok() })
    renderLiveView()

    // Act
    fireEvent.mouseDown(await screen.findByTitle('Bas'))

    // Assert
    await sentWithin(network, SIGNAL, 2500)
  })

  it('onRelease_ShouldStopTheMove_WhenThePointerLeavesTheButton', async () => {
    // Arrange
    const network = fakeNetwork({ [PRESETS]: presetsRead(), [START]: ok(), [STOP]: ok() })
    renderLiveView()
    const up = await screen.findByTitle('Haut')
    fireEvent.mouseDown(up)

    // Act
    fireEvent.mouseLeave(up)

    // Assert
    await sentWithin(network, STOP)
  })

  it('onRelease_ShouldStopTheMove_WhenTheTouchIsCancelled', async () => {
    // Arrange
    const network = fakeNetwork({ [PRESETS]: presetsRead(), [START]: ok(), [STOP]: ok() })
    renderLiveView()
    const down = await screen.findByTitle('Bas')
    fireEvent.touchStart(down)

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

  it('onPress_ShouldStopSignalling_WhenTheCameraRefusesTheMove', async () => {
    // Arrange
    const network = fakeNetwork({
      [PRESETS]: presetsRead(),
      [START]: failure(502, 'camera_refused'),
      [SIGNAL]: ok(),
    })
    renderLiveView()
    fireEvent.mouseDown(await screen.findByTitle('Haut'))
    await screen.findByText('La caméra a refusé la commande')

    // Act
    // Nothing on screen marks a signal not sent: wait past the first one.
    await new Promise((resolve) => setTimeout(resolve, 1200))

    // Assert
    expect(network.sent).not.toContainEqual(expect.objectContaining({ route: SIGNAL }))
  })

  it('onRelease_ShouldShowOneToastPerPress_WhenTheStartAndTheStopFail', async () => {
    // Arrange
    const network = fakeNetwork({
      [PRESETS]: presetsRead(),
      [START]: failure(502, 'camera_refused'),
      [STOP]: failure(503, undefined, 'stop lost'),
    })
    renderLiveView()
    const up = await screen.findByTitle('Haut')
    fireEvent.mouseDown(up)
    await screen.findByText('La caméra a refusé la commande')

    // Act
    fireEvent.mouseUp(up)
    await sentWithin(network, STOP)

    // Assert
    expect(screen.getAllByText('La caméra a refusé la commande')).toHaveLength(1)
    expect(screen.queryByText(/stop lost/)).not.toBeInTheDocument()
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

describe('LiveView video', () => {
  const H264_AAC = 'video/mp4; codecs="avc1.64001E,mp4a.40.2"'

  afterEach(() => {
    vi.restoreAllMocks()
  })

  function renderVideo(qualities: LiveQuality[] = ['low', 'high']) {
    fakeNetwork({})
    return renderScreen(
      <LiveView
        cameraId="camera-1"
        label="Front Door"
        orientation={OrientationControl.Off}
        qualities={qualities}
      />,
    )
  }

  // go2rtc answers with H.264 and AAC, then sends a first segment.
  async function theStreamPlays(sockets = 1) {
    await waitFor(() => expect(FakeSocket.opened).toHaveLength(sockets))
    const socket = FakeSocket.latest()
    socket.open()
    socket.answer(H264_AAC)
    socket.segment()
    return socket
  }

  it('LiveView_ShouldShowTheRefreshedPictureAndSayWhy_WhenTheBrowserCannotPlayVideo', () => {
    // Arrange & Act
    renderVideo()

    // Assert
    expect(
      screen.getByText(
        'Ce navigateur ne lit pas la vidéo en direct : image rafraîchie chaque seconde.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByText('live camera-1 low: MediaSource unavailable')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Front Door' })).toBeInTheDocument()
  })

  it('LiveView_ShouldPlayTheLowQualityMutedFirst_WhenOpened', async () => {
    // Arrange
    stubBrowserMse()
    renderVideo()

    // Act
    const socket = await theStreamPlays()

    // Assert
    expect(socket.url).toContain('/api/cameras/camera-1/live/ws?quality=low')
    expect(await screen.findByRole('button', { name: 'Activer le son' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Haute qualité' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    expect(screen.getByLabelText<HTMLVideoElement>('Front Door').muted).toBe(true)
  })

  it('LiveView_ShouldOpenTheHighQuality_WhenTheUserPressesHd', async () => {
    // Arrange
    stubBrowserMse()
    renderVideo()
    await theStreamPlays()

    // Act
    await userEvent.click(await screen.findByRole('button', { name: 'Haute qualité' }))

    // Assert
    await waitFor(() => expect(FakeSocket.latest().url).toContain('quality=high'))
    expect(FakeSocket.opened[0].closed).toBe(true)
  })

  it('LiveView_ShouldReopenTheStreamWithItsSound_WhenTheUserTurnsTheSoundOn', async () => {
    // Arrange
    stubBrowserMse()
    renderVideo()
    const muted = await theStreamPlays()

    // Act
    await userEvent.click(await screen.findByRole('button', { name: 'Activer le son' }))
    const withSound = await theStreamPlays(2)

    // Assert
    expect(muted.closed).toBe(true)
    expect(JSON.parse(withSound.sent[0]).value).toContain('mp4a.40.2')
    expect(await screen.findByRole('button', { name: 'Couper le son' })).toBeInTheDocument()
    expect(screen.getByLabelText<HTMLVideoElement>('Front Door').muted).toBe(false)
  })
  it('LiveView_ShouldOfferNoQualitySwitch_WhenTheCameraHasOneQuality', async () => {
    // Arrange
    stubBrowserMse()
    renderVideo(['low'])

    // Act
    await theStreamPlays()

    // Assert
    expect(await screen.findByRole('button', { name: 'Activer le son' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Haute qualité' })).not.toBeInTheDocument()
  })

  it('LiveView_ShouldReconnect_WhenAPlayingStreamIsCut', async () => {
    // Arrange
    stubBrowserMse()
    renderVideo()
    const first = await theStreamPlays()
    await screen.findByRole('button', { name: 'Activer le son' })

    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })

    // Act
    act(() => first.hangUp(1006))
    const waiting = screen.getByText('Reconnexion…')
    act(() => vi.advanceTimersByTime(2000))
    vi.useRealTimers()

    // Assert
    expect(waiting).toBeInTheDocument()
    await waitFor(() => expect(FakeSocket.opened).toHaveLength(2))
  })

  it('LiveView_ShouldSayWhyAndOfferARetry_WhenTheStreamDoesNotArrive', async () => {
    // Arrange
    stubBrowserMse()
    renderVideo()
    await waitFor(() => expect(FakeSocket.opened.length).toBeGreaterThan(0))
    FakeSocket.latest().error('streams: dial tcp: connection refused')

    // Act
    await userEvent.click(await screen.findByRole('button', { name: 'Réessayer' }))

    // Assert
    expect(
      screen.queryByText('La vidéo n’arrive pas : image rafraîchie chaque seconde.'),
    ).not.toBeInTheDocument()
    await waitFor(() => expect(FakeSocket.opened).toHaveLength(2))
  })

  it('LiveView_ShouldSayPrivacyModeWithoutAPicture_WhenTheApiRefusesForPrivacy', async () => {
    // Arrange
    stubBrowserMse()
    renderVideo()
    await waitFor(() => expect(FakeSocket.opened.length).toBeGreaterThan(0))

    // Act
    FakeSocket.latest().hangUp(4409, 'privacy_mode')

    // Assert
    expect(
      await screen.findByText('Mode vie privée : la vue en direct est arrêtée.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: 'Front Door' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Réessayer' })).not.toBeInTheDocument()
  })
})
