import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { makeCamera } from '../../testing/camera_fixture'
import { failure, fakeNetwork, ok } from '../../testing/fake_network'
import { renderScreen } from '../../testing/render_screen'
import { readTheCameraList } from '../../testing/shared_reads'
import { CamerasView } from './cameras.component'

const ROUTE = '/settings/cameras/:cameraId?'
const LIST = { path: ROUTE, url: '/settings/cameras' }
const OPEN_CAMERA = { path: ROUTE, url: '/settings/cameras/camera-1' }

describe('CamerasView', () => {
  it('render_ShouldLinkEachCameraToItsSettings_WhenTheListIsRead', async () => {
    // Arrange
    fakeNetwork({ 'GET /api/cameras': ok([makeCamera()]) })
    renderScreen(<CamerasView />, LIST)

    // Act
    await readTheCameraList()

    // Assert
    expect(screen.getByRole('link', { name: /Front Door/ })).toHaveAttribute(
      'href',
      '/settings/cameras/camera-1/detection',
    )
    expect(screen.getByRole('link', { name: 'Ajouter une caméra' })).toBeInTheDocument()
  })

  it('render_ShouldSayThereIsNoCameraYet_WhenTheListIsEmpty', async () => {
    // Arrange
    fakeNetwork({ 'GET /api/cameras': ok([]) })
    renderScreen(<CamerasView />, LIST)

    // Act
    await readTheCameraList()

    // Assert
    expect(screen.getByText('Aucune caméra pour l’instant.')).toBeInTheDocument()
  })

  it('render_ShouldSayWhyAndWithholdAdding_WhenTheListCannotBeRead', async () => {
    // Arrange
    fakeNetwork({ 'GET /api/cameras': failure(500) })
    renderScreen(<CamerasView />, LIST)

    // Act
    await readTheCameraList()

    // Assert
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Vyzio a rencontré une erreur')
    expect(alert).toHaveTextContent('GET /api/cameras · 500')
    expect(screen.queryByRole('link', { name: 'Ajouter une caméra' })).toBeNull()
  })

  it('onRetry_ShouldShowTheCameras_WhenTheSecondReadSucceeds', async () => {
    // Arrange
    const network = fakeNetwork({ 'GET /api/cameras': failure(500) })
    renderScreen(<CamerasView />, LIST)
    await readTheCameraList()
    network.answer('GET /api/cameras', ok([makeCamera()]))

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Réessayer' }))

    // Assert
    expect(await screen.findByRole('link', { name: /Front Door/ })).toBeInTheDocument()
  })

  it('render_ShouldNameTheCameraAndOfferItsTabs_WhenTheCameraIsInTheList', async () => {
    // Arrange
    fakeNetwork({ 'GET /api/cameras': ok([makeCamera()]) })
    renderScreen(<CamerasView />, OPEN_CAMERA)

    // Act
    await readTheCameraList()

    // Assert
    expect(screen.getByRole('heading', { name: 'Front Door' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Conservation' })).toHaveAttribute(
      'href',
      '/settings/cameras/camera-1/conservation',
    )
  })

  it('render_ShouldSayTheCameraIsNotFound_WhenTheListHasNoSuchCamera', async () => {
    // Arrange
    fakeNetwork({ 'GET /api/cameras': ok([makeCamera({ id: 'camera-2' })]) })
    renderScreen(<CamerasView />, OPEN_CAMERA)

    // Act
    await readTheCameraList()

    // Assert
    expect(screen.getByRole('heading', { name: 'Caméra introuvable' })).toBeInTheDocument()
  })

  it('render_ShouldSayWhyRatherThanNotFound_WhenTheListCannotBeRead', async () => {
    // Arrange
    fakeNetwork({ 'GET /api/cameras': failure(503) })
    renderScreen(<CamerasView />, OPEN_CAMERA)

    // Act
    await readTheCameraList()

    // Assert
    expect(
      screen.getByRole('heading', { name: 'Cette caméra ne s’affiche pas' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('GET /api/cameras · 503')
  })

  it('onRetry_ShouldOpenTheCamera_WhenTheSecondReadSucceeds', async () => {
    // Arrange
    const network = fakeNetwork({ 'GET /api/cameras': failure(503) })
    renderScreen(<CamerasView />, OPEN_CAMERA)
    await readTheCameraList()
    network.answer('GET /api/cameras', ok([makeCamera()]))

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Réessayer' }))

    // Assert
    expect(await screen.findByRole('heading', { name: 'Front Door' })).toBeInTheDocument()
  })
})
