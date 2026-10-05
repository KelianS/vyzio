import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { CameraLiveThumbnail } from './camera_live_thumbnail'
import { makeCamera } from '../../testing/camera_fixture'
import { PrivacyMiss, PrivacyStrategy, type Camera } from '../../domain/entities/camera.entity'

const renderTile = (camera: Camera) =>
  render(
    <MemoryRouter>
      <CameraLiveThumbnail camera={camera} apiBaseUrl="" />
    </MemoryRouter>,
  )

describe('CameraLiveThumbnail', () => {
  it('CameraLiveThumbnail_ShouldSayTheCameraTurned_WhenItAcceptedTheParkingMove', () => {
    // Arrange & Act
    renderTile(makeCamera({ privacyModeActive: true, privacyStrategy: PrivacyStrategy.PtzParking }))

    // Assert
    expect(screen.getByText('Caméra orientée, enregistrement désactivé')).toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('CameraLiveThumbnail_ShouldLinkToThePrivacyScreen_WhenTheCameraDidNotFollow', () => {
    // Arrange & Act
    renderTile(
      makeCamera({
        privacyModeActive: true,
        privacyStrategy: PrivacyStrategy.PtzParking,
        privacyMiss: PrivacyMiss.CameraFailed,
      }),
    )

    // Assert
    expect(screen.getByText('Caméra non tournée, enregistrement désactivé')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'La caméra ne s’est pas tournée' })).toHaveAttribute(
      'href',
      '/settings/cameras/camera-1/vie-privee',
    )
  })

  it('CameraLiveThumbnail_ShouldStillLinkToWhy_WhenTheCameraDidNotComeBackAfterPrivacy', () => {
    // Arrange & Act
    renderTile(
      makeCamera({
        privacyStrategy: PrivacyStrategy.PtzParking,
        privacyMiss: PrivacyMiss.CameraFailed,
      }),
    )

    // Assert
    expect(screen.getByRole('link', { name: 'La caméra n’est pas revenue' })).toBeInTheDocument()
  })

  it('CameraLiveThumbnail_ShouldLeadToItsPageWithoutAnyImage_WhenTheCameraIsToSetUp', () => {
    // Arrange & Act
    renderTile(makeCamera({ status: 'to_set_up', validationState: 'to_set_up', connected: false }))

    // Assert
    expect(screen.getByRole('link', { name: 'À configurer : Front Door' })).toHaveAttribute(
      'href',
      '/settings/cameras/camera-1',
    )
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.queryByText('Hors ligne')).not.toBeInTheDocument()
  })

  it('CameraLiveThumbnail_ShouldLeadToItsPageWithoutAnyImage_WhenTheCameraWaitsForTheRestart', () => {
    // Arrange & Act
    renderTile(makeCamera({ status: 'online', validationState: 'draft' }))

    // Assert
    expect(screen.getByRole('link', { name: 'À configurer : Front Door' })).toHaveAttribute(
      'href',
      '/settings/cameras/camera-1',
    )
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(document.querySelector('.bg-success')).toBeNull()
  })

  it.each([
    { connected: true, status: 'online', buttons: 1 },
    { connected: false, status: 'offline', buttons: 0 },
  ])(
    'CameraLiveThumbnail_ShouldOpenTheLiveViewOnlyWhenTheCameraAnswers_WhenItIs $status',
    ({ connected, status, buttons }) => {
      // Arrange & Act
      render(
        <MemoryRouter>
          <CameraLiveThumbnail
            camera={makeCamera({ connected, status })}
            apiBaseUrl=""
            onExpand={() => undefined}
          />
        </MemoryRouter>,
      )

      // Assert
      expect(screen.queryAllByRole('button', { name: 'Front Door' })).toHaveLength(buttons)
    },
  )
})
