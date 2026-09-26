import { describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Camera } from '../../domain/entities/camera.entity'
import type { CameraImageSettings } from '../../domain/entities/camera_image_settings.entity'
import { makeCamera } from '../../testing/camera_fixture'
import { makeImageSettingsBinding } from '../../testing/capability_binding_fixture'
import { failure, fakeNetwork, ok } from '../../testing/fake_network'
import { renderScreen } from '../../testing/render_screen'
import { CameraImageView } from './camera_image.component'

const SETTINGS = 'GET /api/cameras/camera-1/image-settings'
const SAVE_SETTINGS = 'PUT /api/cameras/camera-1/image-settings'
const BINDINGS = 'GET /api/cameras/camera-1/capabilities'
const PRESETS = 'GET /api/cameras/camera-1/ptz/presets'

const imageCamera = makeCamera({ verifiedCapabilities: ['image_settings'] })
const ptzCamera = makeCamera({ ptzSupported: true })

const settings: CameraImageSettings = {
  brightness: 50,
  contrast: 50,
  saturation: 50,
  sharpness: 50,
  irCutMode: 'auto',
}

function imageTab(camera: Camera) {
  return {
    path: '/settings/cameras/:cameraId/image',
    url: '/settings/cameras/camera-1/image',
    outletContext: camera,
  }
}

function presetsRead(currentPosition: { x: number; y: number } | null, calibrated = true) {
  return ok({ presets: [], calibrated, currentPosition })
}

async function raiseTheBrightness() {
  const brightness = await screen.findByRole('slider', { name: 'Luminosité' })
  brightness.focus()
  await userEvent.keyboard('{ArrowRight}')
}

describe('CameraImageView', () => {
  it('onLoad_ShouldOfferEveryAdjustment_WhenTheCameraWritesThemAll', async () => {
    // Arrange
    fakeNetwork({ [SETTINGS]: ok(settings), [BINDINGS]: ok([]) })

    // Act
    renderScreen(<CameraImageView />, imageTab(imageCamera))

    // Assert
    expect(await screen.findByRole('slider', { name: 'Netteté' })).toBeInTheDocument()
    expect(screen.getByText('Vision nocturne')).toBeInTheDocument()
  })

  it('onLoad_ShouldHideSharpnessAndNightVision_WhenTheSettingsGoThroughDvrip', async () => {
    // Arrange
    fakeNetwork({ [SETTINGS]: ok(settings), [BINDINGS]: ok([makeImageSettingsBinding('dvrip')]) })

    // Act
    renderScreen(<CameraImageView />, imageTab(imageCamera))

    // Assert
    expect(await screen.findByRole('slider', { name: 'Luminosité' })).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.queryByRole('slider', { name: 'Netteté' })).not.toBeInTheDocument(),
    )
    expect(screen.queryByText('Vision nocturne')).not.toBeInTheDocument()
  })

  it('onSave_ShouldSendTheNewValue_WhenTheUserRaisesTheBrightness', async () => {
    // Arrange
    const network = fakeNetwork({
      [SETTINGS]: ok(settings),
      [BINDINGS]: ok([]),
      [SAVE_SETTINGS]: ok(settings),
    })
    renderScreen(<CameraImageView />, imageTab(imageCamera))
    await raiseTheBrightness()

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    // Assert
    expect(await screen.findByText('Réglages d’image enregistrés.')).toBeInTheDocument()
    expect(network.sent).toContainEqual(
      expect.objectContaining({
        route: SAVE_SETTINGS,
        body: expect.objectContaining({ brightness: 51, contrast: 50 }),
      }),
    )
  })

  it('onSave_ShouldKeepTheDraftAndSayWhy_WhenTheSaveFails', async () => {
    // Arrange
    fakeNetwork({ [SETTINGS]: ok(settings), [BINDINGS]: ok([]), [SAVE_SETTINGS]: failure(500) })
    renderScreen(<CameraImageView />, imageTab(imageCamera))
    await raiseTheBrightness()

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    // Assert
    expect(await screen.findByText(/Vyzio a rencontré une erreur/)).toBeInTheDocument()
    expect(screen.getByText(/PUT \/api\/cameras\/camera-1\/image-settings · 500/)).toBeVisible()
    expect(screen.getByRole('slider', { name: 'Luminosité' })).toHaveAttribute(
      'aria-valuenow',
      '51',
    )
  })

  it('onLoad_ShouldSayThereIsNeitherImageNorControl_WhenTheCameraExposesNeither', async () => {
    // Arrange
    fakeNetwork({})

    // Act
    renderScreen(<CameraImageView />, imageTab(makeCamera()))

    // Assert
    expect(
      await screen.findByText('Cette caméra n’expose ni réglages d’image ni pilotage.'),
    ).toBeInTheDocument()
  })

  it('onLoad_ShouldSayWhereTheCameraStands_WhenItIsCalibrated', async () => {
    // Arrange
    fakeNetwork({ [PRESETS]: presetsRead({ x: 3, y: 2 }) })

    // Act
    renderScreen(<CameraImageView />, imageTab(ptzCamera))

    // Assert
    expect(await screen.findByText('Position actuelle : 3, 2')).toBeInTheDocument()
  })

  it('onLoad_ShouldAskForACalibration_WhenTheCameraHasNoReference', async () => {
    // Arrange
    fakeNetwork({ [PRESETS]: presetsRead(null, false) })

    // Act
    renderScreen(<CameraImageView />, imageTab(ptzCamera))

    // Assert
    expect(await screen.findByText(/pas encore de position de référence/)).toBeInTheDocument()
  })

  it('onLoad_ShouldSayWhyAndForSupport_WhenThePositionCannotBeRead', async () => {
    // Arrange
    fakeNetwork({ [PRESETS]: failure(500) })

    // Act
    renderScreen(<CameraImageView />, imageTab(ptzCamera))

    // Assert
    expect(await screen.findByText(/Vyzio a rencontré une erreur/)).toBeInTheDocument()
    expect(screen.getByText(/GET \/api\/cameras\/camera-1\/ptz\/presets · 500/)).toBeVisible()
  })

  it('onLoad_ShouldKeepTheControlOnScreen_WhenTheImageSettingsCannotBeRead', async () => {
    // Arrange
    fakeNetwork({
      [SETTINGS]: failure(500),
      [BINDINGS]: ok([]),
      [PRESETS]: presetsRead({ x: 3, y: 2 }),
    })

    // Act
    renderScreen(
      <CameraImageView />,
      imageTab(makeCamera({ ptzSupported: true, verifiedCapabilities: ['image_settings'] })),
    )

    // Assert
    expect(await screen.findByRole('button', { name: 'Piloter la caméra' })).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText('Chargement…')).not.toBeInTheDocument())
    expect(screen.queryByRole('slider')).not.toBeInTheDocument()
  })

  it('onCloseLiveView_ShouldReadWhereTheCameraStandsAgain_WhenTheLiveViewCloses', async () => {
    // Arrange
    const network = fakeNetwork({ [PRESETS]: presetsRead(null) })
    renderScreen(<CameraImageView />, imageTab(ptzCamera))
    await userEvent.click(await screen.findByRole('button', { name: 'Piloter la caméra' }))
    network.answer(PRESETS, presetsRead({ x: 7, y: 4 }))

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Fermer' }))

    // Assert
    expect(await screen.findByText('Position actuelle : 7, 4')).toBeInTheDocument()
  })
})
