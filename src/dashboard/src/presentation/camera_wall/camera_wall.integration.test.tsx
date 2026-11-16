import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { makeCamera } from '../../testing/camera_fixture'
import { failure, fakeNetwork, ok } from '../../testing/fake_network'
import { renderScreen } from '../../testing/render_screen'
import { readTheCameraList } from '../../testing/shared_reads'
import { CameraWallView } from './camera_wall.component'

const cameras = ['Porte', 'Jardin', 'Garage', 'Salon', 'Cave'].map((name, index) =>
  makeCamera({ id: `camera-${index + 1}`, slug: name.toLowerCase(), displayName: name }),
)

describe('CameraWallView', () => {
  it('render_ShouldShowEveryCameraWithItsEye_WhenTheListIsRead', async () => {
    // Arrange
    fakeNetwork({ 'GET /api/cameras': ok(cameras) })
    renderScreen(<CameraWallView />)

    // Act
    await readTheCameraList()

    // Assert
    expect(screen.getAllByRole('article')).toHaveLength(5)
    expect(screen.getByRole('button', { name: 'Couper Cave' })).toBeInTheDocument()
  })

  it('onTogglePrivacy_ShouldCutTheCameraWithoutAsking_WhenTheUserTapsItsEye', async () => {
    // Arrange
    const network = fakeNetwork({
      'GET /api/cameras': ok(cameras),
      'POST /api/cameras/privacy/batch-toggle': ok([]),
    })
    renderScreen(<CameraWallView />)
    await readTheCameraList()
    network.answer(
      'GET /api/cameras',
      ok(cameras.map((camera) => ({ ...camera, privacyModeActive: camera.id === 'camera-5' }))),
    )

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Couper Cave' }))

    // Assert
    expect(await screen.findByRole('button', { name: 'Réactiver Cave' })).toBeInTheDocument()
  })

  it('render_ShouldSayTheListCouldNotBeRead_WhenTheCamerasDoNotAnswer', async () => {
    // Arrange
    fakeNetwork({ 'GET /api/cameras': failure(503) })
    renderScreen(<CameraWallView />)

    // Act
    await readTheCameraList()

    // Assert
    expect(screen.getByText('La liste de vos caméras n’a pas pu être lue.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeInTheDocument()
  })
})
