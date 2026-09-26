import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PrivacyAnswerNotice } from './privacy_answer_notice'
import { makeCamera } from '../../../testing/camera_fixture'
import { PrivacyMiss, PrivacyStrategy } from '../../../domain/entities/camera.entity'

describe('PrivacyAnswerNotice', () => {
  it('PrivacyAnswerNotice_ShouldConfirmTheCut_WhenTheCameraConfirmedIt', () => {
    // Arrange & Act
    render(
      <PrivacyAnswerNotice
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
    expect(screen.getByText('Caméra non tournée, enregistrement désactivé')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(
      /ne s’est pas tournée vers sa position Parking.*ONVIF Ptz: no answer/,
    )
  })

  it('PrivacyAnswerNotice_ShouldShowNothing_WhenPrivacyIsOffAndTheCameraFollowed', () => {
    // Arrange & Act
    const { container } = render(<PrivacyAnswerNotice camera={makeCamera()} />)

    // Assert
    expect(container).toBeEmptyDOMElement()
  })
})
