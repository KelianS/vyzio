import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { CameraCard } from './camera_card'
import { makeCamera } from '../../testing/camera_fixture'
import { PrivacyMiss, PrivacyStrategy, type Camera } from '../../domain/entities/camera.entity'

const renderCard = (camera: Camera, onTogglePrivacy = vi.fn()) =>
  render(
    <MemoryRouter>
      <CameraCard
        camera={camera}
        apiBaseUrl=""
        liveTo={`/cameras/${camera.id}`}
        onTogglePrivacy={onTogglePrivacy}
      />
    </MemoryRouter>,
  )

describe('CameraCard', () => {
  it('CameraCard_ShouldSayItIsCutInPlaceOfThePicture_WhenTheCameraIsCut', () => {
    // Arrange & Act
    renderCard(makeCamera({ privacyModeActive: true, privacyStrategy: PrivacyStrategy.PtzParking }))

    // Assert
    expect(screen.getByText('Coupée')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Coupée' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Réactiver Front Door' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it.each([
    { cut: false, label: 'Couper Front Door', active: true },
    { cut: true, label: 'Réactiver Front Door', active: false },
  ])(
    'CameraCard_ShouldAskTheOppositeStateAtOnce_WhenTheEyeIsTapped ($label)',
    async ({ cut, label, active }) => {
      // Arrange
      const onTogglePrivacy = vi.fn()
      const camera = makeCamera({ privacyModeActive: cut })
      renderCard(camera, onTogglePrivacy)

      // Act
      await userEvent.click(screen.getByRole('button', { name: label }))

      // Assert
      expect(onTogglePrivacy).toHaveBeenCalledWith(camera, active)
    },
  )

  it('CameraCard_ShouldCarryNoMissLine_WhenTheCameraDidNotFollow', () => {
    // Arrange & Act
    renderCard(
      makeCamera({
        privacyModeActive: true,
        privacyStrategy: PrivacyStrategy.PtzParking,
        privacyMiss: PrivacyMiss.CameraFailed,
      }),
    )

    // Assert
    expect(screen.queryByText(/ne s’est pas tournée/)).not.toBeInTheDocument()
  })

  it.each([
    { status: 'to_set_up', validationState: 'to_set_up', connected: false },
    { status: 'online', validationState: 'draft', connected: true },
  ])(
    'CameraCard_ShouldLeadToItsPageWithTheGreyMark_WhenSurveillanceHasNotTakenItIn ($validationState)',
    ({ status, validationState, connected }) => {
      // Arrange & Act
      renderCard(makeCamera({ status, validationState, connected }))

      // Assert
      expect(screen.getByRole('link', { name: 'À configurer : Front Door' })).toHaveAttribute(
        'href',
        '/settings/cameras/camera-1',
      )
      expect(screen.getByRole('img', { name: 'À configurer' })).toBeInTheDocument()
    },
  )

  it.each([
    { connected: true, status: 'online', link: 'Front Door', mark: 'En marche' },
    { connected: false, status: 'offline', link: 'Front Door : Hors ligne', mark: 'Hors ligne' },
  ])(
    'CameraCard_ShouldOpenTheCameraView_WhenTheCameraIs $status',
    ({ connected, status, link, mark }) => {
      // Arrange & Act
      renderCard(makeCamera({ connected, status }))

      // Assert
      expect(screen.getByRole('link', { name: link })).toHaveAttribute('href', '/cameras/camera-1')
      expect(screen.getByRole('img', { name: mark })).toBeInTheDocument()
    },
  )

  it('CameraCard_ShouldSayUntilWhenTheCameraStaysCut_WhenARangeCutIt', () => {
    // Arrange & Act
    renderCard(
      makeCamera({
        privacyModeActive: true,
        privacyModeSource: 'schedule',
        privacyCutUntil: { at: '2099-01-05T07:00:00+01:00', dayOfWeek: 1, time: '07:00' },
      }),
    )

    // Assert
    expect(screen.getByText('Coupée jusqu’à lundi 7 h')).toBeInTheDocument()
  })
})
