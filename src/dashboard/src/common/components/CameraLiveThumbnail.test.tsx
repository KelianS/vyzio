import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { CameraLiveThumbnail } from './CameraLiveThumbnail'
import { makeCamera } from '../../testing/cameraFixture'
import { PrivacyMiss, PrivacyStrategy, type Camera } from '../../domain/entities/Camera'

const renderTile = (camera: Camera) =>
  render(
    <MemoryRouter>
      <CameraLiveThumbnail camera={camera} apiBaseUrl="" />
    </MemoryRouter>,
  )

describe('CameraLiveThumbnail', () => {
  it('CameraLiveThumbnail_ShouldSayTheCameraTurned_WhenItAcceptedTheParkingMove', () => {
    renderTile(makeCamera({ privacyModeActive: true, privacyStrategy: PrivacyStrategy.PtzParking }))

    expect(screen.getByText('Caméra orientée, enregistrement désactivé')).toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('CameraLiveThumbnail_ShouldLinkToThePrivacyScreen_WhenTheCameraDidNotFollow', () => {
    renderTile(
      makeCamera({
        privacyModeActive: true,
        privacyStrategy: PrivacyStrategy.PtzParking,
        privacyMiss: PrivacyMiss.CameraFailed,
      }),
    )

    expect(
      screen.getByText('La caméra n’a pas suivi, enregistrement désactivé'),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'La caméra n’a pas suivi' })).toHaveAttribute(
      'href',
      '/settings/cameras/camera-1/vie-privee',
    )
  })

  it('CameraLiveThumbnail_ShouldStillLinkToWhy_WhenTheCameraDidNotComeBackAfterPrivacy', () => {
    renderTile(
      makeCamera({
        privacyStrategy: PrivacyStrategy.PtzParking,
        privacyMiss: PrivacyMiss.CameraFailed,
      }),
    )

    expect(screen.getByRole('link', { name: 'La caméra n’a pas suivi' })).toBeInTheDocument()
  })
})
