import { describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PrivacyAnswerNotice } from './privacy_answer_notice'
import { makeCamera } from '../../../testing/camera_fixture'
import { PrivacyMiss, PrivacyStrategy } from '../../../domain/entities/camera.entity'

describe('PrivacyAnswerNotice', () => {
  it('PrivacyAnswerNotice_ShouldConfirmTheCut_WhenTheCameraConfirmedIt', () => {
    // Arrange & Act
    render(
      <PrivacyAnswerNotice
        onRetry={vi.fn()}
        retrying={false}
        camera={makeCamera({ privacyModeActive: true, privacyVendorCut: true })}
      />,
    )

    // Assert
    expect(screen.getByText('Coupure matérielle confirmée')).toBeInTheDocument()
  })

  it('PrivacyAnswerNotice_ShouldSayWhatHappenedAndShowTheDetail_WhenTheCameraDidNotFollow', () => {
    // Arrange & Act
    render(
      <PrivacyAnswerNotice
        onRetry={vi.fn()}
        retrying={false}
        camera={makeCamera({
          privacyModeActive: true,
          privacyStrategy: PrivacyStrategy.PtzParking,
          privacyMiss: PrivacyMiss.CameraFailed,
          privacyMissDetail:
            'privacy on, ptz_parking: CameraUnreachableException: ONVIF Ptz: no answer',
        })}
      />,
    )

    // Assert
    expect(screen.getByText('La caméra ne s’est pas tournée')).toBeInTheDocument()
    expect(screen.getByText('Enregistrement désactivé')).toBeInTheDocument()
    expect(
      screen.queryByText('Caméra non tournée, enregistrement désactivé'),
    ).not.toBeInTheDocument()
  })

  it('PrivacyAnswerNotice_ShouldFoldTheFullAccountAndTheDetail_WhenTheCameraDidNotFollow', async () => {
    // Arrange
    render(
      <PrivacyAnswerNotice
        onRetry={vi.fn()}
        retrying={false}
        camera={makeCamera({
          privacyModeActive: true,
          privacyStrategy: PrivacyStrategy.PtzParking,
          privacyMiss: PrivacyMiss.CameraFailed,
          privacyMissDetail:
            'privacy on, ptz_parking: CameraUnreachableException: ONVIF Ptz: no answer',
        })}
      />,
    )
    const sentence = screen.getByText(/ne s’est pas tournée vers sa position Parking/)
    expect(sentence).not.toBeVisible()

    // Act
    await userEvent.click(screen.getByText('Détails techniques'))

    // Assert
    expect(sentence).toBeVisible()
    expect(screen.getByText(/ONVIF Ptz: no answer/)).toBeVisible()
  })

  it('PrivacyAnswerNotice_ShouldNotClaimRecordingIsOff_WhenTheReturnWasInterrupted', () => {
    // Arrange & Act
    render(
      <PrivacyAnswerNotice
        onRetry={vi.fn()}
        retrying={false}
        camera={makeCamera({
          privacyStrategy: PrivacyStrategy.PtzParking,
          privacyMiss: PrivacyMiss.Unconfirmed,
        })}
      />,
    )

    // Assert
    expect(screen.getByText('La caméra n’a peut-être pas repris sa position')).toBeInTheDocument()
    expect(screen.queryByText(/Enregistrement désactivé/)).not.toBeInTheDocument()
  })

  it('PrivacyAnswerNotice_ShouldShowNothing_WhenPrivacyIsOffAndTheCameraFollowed', () => {
    // Arrange & Act
    const { container } = render(
      <PrivacyAnswerNotice camera={makeCamera()} onRetry={vi.fn()} retrying={false} />,
    )

    // Assert
    expect(container).toBeEmptyDOMElement()
  })

  it.each([
    [PrivacyMiss.PositionMissing, 'Enregistrer ses positions', '/cameras/camera-1'],
    [
      PrivacyMiss.CapabilityUnverified,
      'Vérifier dans Connexion',
      '/settings/cameras/camera-1/connection',
    ],
  ])(
    'PrivacyAnswerNotice_ShouldLeadToWhereTheMissIsFixed_WhenTheCameraCannotFollowYet (%s)',
    (miss, name, href) => {
      // Arrange & Act
      render(
        <PrivacyAnswerNotice
          onRetry={vi.fn()}
          retrying={false}
          camera={makeCamera({
            id: 'camera-1',
            privacyModeActive: true,
            privacyStrategy: PrivacyStrategy.PtzParking,
            privacyMiss: miss,
          })}
        />,
        { wrapper: MemoryRouter },
      )

      // Assert
      expect(screen.getByRole('link', { name })).toHaveAttribute('href', href)
      expect(screen.queryByRole('button', { name: 'Réessayer' })).not.toBeInTheDocument()
    },
  )

  it('PrivacyAnswerNotice_ShouldAskTheCameraAgain_WhenTheUserRetries', async () => {
    // Arrange
    const onRetry = vi.fn()
    render(
      <PrivacyAnswerNotice
        onRetry={onRetry}
        retrying={false}
        camera={makeCamera({
          privacyModeActive: true,
          privacyStrategy: PrivacyStrategy.PtzParking,
          privacyMiss: PrivacyMiss.Unconfirmed,
        })}
      />,
    )

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'Réessayer' }))

    // Assert
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('PrivacyAnswerNotice_ShouldNotOfferASecondTry_WhenTheFirstIsRunning', () => {
    // Arrange & Act
    render(
      <PrivacyAnswerNotice
        onRetry={vi.fn()}
        retrying
        camera={makeCamera({
          privacyModeActive: true,
          privacyStrategy: PrivacyStrategy.PtzParking,
          privacyMiss: PrivacyMiss.CameraFailed,
        })}
      />,
    )

    // Assert
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeDisabled()
  })
})
