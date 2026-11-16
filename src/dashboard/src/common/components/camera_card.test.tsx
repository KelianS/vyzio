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

  it('CameraCard_ShouldLinkToThePrivacyScreen_WhenTheCameraDidNotFollow', () => {
    // Arrange & Act
    renderCard(
      makeCamera({
        privacyModeActive: true,
        privacyStrategy: PrivacyStrategy.PtzParking,
        privacyMiss: PrivacyMiss.CameraFailed,
      }),
    )

    // Assert
    expect(screen.getByRole('link', { name: 'La caméra ne s’est pas tournée' })).toHaveAttribute(
      'href',
      '/settings/cameras/camera-1/privacy',
    )
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
    { connected: true, status: 'online', links: 1, mark: 'En marche' },
    { connected: false, status: 'offline', links: 0, mark: 'Hors ligne' },
  ])(
    'CameraCard_ShouldOpenTheViewOnlyWhenTheCameraAnswers_WhenItIs $status',
    ({ connected, status, links, mark }) => {
      // Arrange & Act
      renderCard(makeCamera({ connected, status }))

      // Assert
      expect(screen.queryAllByRole('link', { name: 'Front Door' })).toHaveLength(links)
      expect(screen.getByRole('img', { name: mark })).toBeInTheDocument()
    },
  )
})
