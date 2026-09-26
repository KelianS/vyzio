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
})
