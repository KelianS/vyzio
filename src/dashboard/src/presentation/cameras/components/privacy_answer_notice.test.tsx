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

  it('PrivacyAnswerNotice_ShouldSayNothingInThePage_WhenTheCameraDidNotFollow', () => {
    // Arrange & Act
    const { container } = render(
      <PrivacyAnswerNotice
        camera={makeCamera({
          privacyModeActive: true,
          privacyStrategy: PrivacyStrategy.PtzParking,
          privacyMiss: PrivacyMiss.CameraFailed,
          privacyMissDetail: 'privacy on, ptz_parking: no answer',
        })}
      />,
    )

    // Assert
    expect(container).toBeEmptyDOMElement()
  })

  it('PrivacyAnswerNotice_ShouldShowNothing_WhenPrivacyIsOffAndTheCameraFollowed', () => {
    // Arrange & Act
    const { container } = render(<PrivacyAnswerNotice camera={makeCamera()} />)

    // Assert
    expect(container).toBeEmptyDOMElement()
  })
})
