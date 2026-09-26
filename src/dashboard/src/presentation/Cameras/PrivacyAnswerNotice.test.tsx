import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PrivacyAnswerNotice } from './PrivacyAnswerNotice'
import { makeCamera } from '../../testing/cameraFixture'
import { PrivacyMiss, PrivacyStrategy } from '../../domain/entities/Camera'

describe('PrivacyAnswerNotice', () => {
  it('PrivacyAnswerNotice_ShouldConfirmTheCut_WhenTheCameraConfirmedIt', () => {
    render(
      <PrivacyAnswerNotice
        camera={makeCamera({ privacyModeActive: true, privacyVendorCut: true })}
      />,
    )

    expect(screen.getByText('Coupure matérielle confirmée')).toBeInTheDocument()
  })

  it('PrivacyAnswerNotice_ShouldSayWhatHappenedAndShowTheDetail_WhenTheCameraDidNotFollow', () => {
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

    expect(screen.getByText('Caméra non tournée, enregistrement désactivé')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(
      /ne s’est pas tournée vers sa position Parking.*ONVIF Ptz: no answer/,
    )
  })

  it('PrivacyAnswerNotice_ShouldShowNothing_WhenPrivacyIsOffAndTheCameraFollowed', () => {
    const { container } = render(<PrivacyAnswerNotice camera={makeCamera()} />)

    expect(container).toBeEmptyDOMElement()
  })
})
